"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  facilityCreateInputSchema,
  facilityUpdateInputSchema,
} from "@/lib/clubs/input-schema";
import { logAdminAction } from "@/server/audit/log";
import {
  requireSuperAdmin,
  SuperAdminRequiredError,
} from "@/server/auth/guards";
import { countActiveFacilities } from "@/server/facilities/list";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

// 館マスター（facilities）の CRUD。全館管理者 (super_admin) のみ利用可能。
// 削除はソフト削除。既存クラブ・予約・admin_facilities 行は温存される。
// 新規館作成時は、作成時点で「全ての有効館」を持っていた super_admin に、
// 作成した新館の admin_facilities 行を自動付与する（super_admin 権限を維持するため）。

export type FacilityActionResult =
  | { ok: true }
  | { ok: false; kind: "forbidden"; message: string }
  | { ok: false; kind: "input"; fieldErrors: Record<string, string> }
  | { ok: false; kind: "not_found"; message: string }
  | { ok: false; kind: "unknown"; message: string };

function collectFieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map((p) => String(p)).join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

function translateUniqueViolation(
  error: { code?: string; message?: string } | null,
): string | null {
  if (!error) return null;
  if (error.code === "23505") {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("code")) {
      return "この prefix は既に使われています。\n別の prefix を指定してください。";
    }
    return "同じ値が既に登録されています。";
  }
  return null;
}

async function requireSuper(): Promise<
  { ok: true; adminId: string } | { ok: false; message: string }
> {
  try {
    const ctx = await requireSuperAdmin();
    return { ok: true, adminId: ctx.adminId };
  } catch (error) {
    if (error instanceof SuperAdminRequiredError) {
      return {
        ok: false,
        message: "この操作は全館管理者のみ実行できます。",
      };
    }
    throw error;
  }
}

export async function createFacilityAction(
  rawInput: unknown,
): Promise<FacilityActionResult | never> {
  const guard = await requireSuper();
  if (!guard.ok) {
    return { ok: false, kind: "forbidden", message: guard.message };
  }

  const parsed = facilityCreateInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "input",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }
  const input = parsed.data;
  const admin = getSupabaseAdminClient();

  // 作成前の有効館数をスナップショット（既存 super_admin 判定に使う）。
  const totalActiveBefore = await countActiveFacilities();

  const { data, error } = await admin
    .from("facilities")
    .insert({
      code: input.code,
      name: input.name,
      phone: input.phone,
    })
    .select("id, code, name")
    .single<{ id: number; code: string; name: string }>();

  if (error || !data) {
    console.error("[admin.facilities.create] insert failed", {
      code: error?.code,
      message: error?.message,
    });
    const dupMsg = translateUniqueViolation(error);
    if (dupMsg) {
      return {
        ok: false,
        kind: "input",
        fieldErrors: { code: dupMsg },
      };
    }
    return {
      ok: false,
      kind: "unknown",
      message: "館の登録に失敗しました。\nもう一度お試しください。",
    };
  }

  // 既存 super_admin（= 作成前の全有効館を持っていた admin）に新館の権限を自動付与。
  // admin_facilities を admin_id ごとに集計し、「作成前の totalActiveBefore 件以上持つ」
  // admin を洗い出す。
  if (totalActiveBefore > 0) {
    const { data: joined, error: listError } = await admin
      .from("admin_facilities")
      .select("admin_id, facilities!inner(id, deleted_at)");
    if (listError) {
      console.warn(
        "[admin.facilities.create] could not preserve super_admins",
        {
          code: listError.code,
          message: listError.message,
        },
      );
    } else {
      const activeByAdmin = new Map<string, Set<number>>();
      type Row = {
        admin_id: string;
        facilities:
          | { id: number; deleted_at: string | null }
          | Array<{ id: number; deleted_at: string | null }>
          | null;
      };
      for (const raw of (joined ?? []) as Row[]) {
        const items = Array.isArray(raw.facilities)
          ? raw.facilities
          : raw.facilities
            ? [raw.facilities]
            : [];
        for (const item of items) {
          if (item.deleted_at) continue;
          // 新しく作った facility は totalActiveBefore に含まれないのでスキップ
          if (item.id === data.id) continue;
          const set =
            activeByAdmin.get(raw.admin_id) ??
            (activeByAdmin
              .set(raw.admin_id, new Set())
              .get(raw.admin_id) as Set<number>);
          set.add(item.id);
        }
      }
      const superAdminIds: string[] = [];
      for (const [adminId, set] of activeByAdmin.entries()) {
        if (set.size >= totalActiveBefore) superAdminIds.push(adminId);
      }
      if (superAdminIds.length > 0) {
        const { error: insertError } = await admin
          .from("admin_facilities")
          .insert(
            superAdminIds.map((adminId) => ({
              admin_id: adminId,
              facility_id: data.id,
            })),
          );
        if (insertError) {
          console.warn(
            "[admin.facilities.create] failed to grant existing super_admins",
            {
              code: insertError.code,
              message: insertError.message,
            },
          );
        }
      }
    }
  }

  await logAdminAction({
    adminId: guard.adminId,
    action: "facility.create",
    targetType: "facility",
    targetId: String(data.id),
    metadata: { code: data.code, name: data.name },
  });

  revalidatePath("/admin/facilities");
  revalidatePath("/admin/clubs");
  revalidatePath("/");
  redirect("/admin/facilities");
}

export async function updateFacilityAction(
  facilityId: number,
  rawInput: unknown,
): Promise<FacilityActionResult | never> {
  const guard = await requireSuper();
  if (!guard.ok) {
    return { ok: false, kind: "forbidden", message: guard.message };
  }

  const parsed = facilityUpdateInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "input",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }
  const input = parsed.data;
  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin
    .from("facilities")
    .select("id, name, phone, code, deleted_at")
    .eq("id", facilityId)
    .maybeSingle<{
      id: number;
      name: string;
      phone: string;
      code: string;
      deleted_at: string | null;
    }>();
  if (!existing) {
    return {
      ok: false,
      kind: "not_found",
      message: "対象の館が見つかりません。",
    };
  }
  if (existing.deleted_at) {
    return {
      ok: false,
      kind: "not_found",
      message: "この館は削除済みです。編集できません。",
    };
  }

  const { error } = await admin
    .from("facilities")
    .update({ name: input.name, phone: input.phone })
    .eq("id", facilityId);

  if (error) {
    console.error("[admin.facilities.update] update failed", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      kind: "unknown",
      message: "館の更新に失敗しました。\nもう一度お試しください。",
    };
  }

  await logAdminAction({
    adminId: guard.adminId,
    action: "facility.update",
    targetType: "facility",
    targetId: String(facilityId),
    metadata: {
      code: existing.code,
      nameBefore: existing.name,
      nameAfter: input.name,
      phoneBefore: existing.phone,
      phoneAfter: input.phone,
    },
  });

  revalidatePath("/admin/facilities");
  revalidatePath("/admin/clubs");
  revalidatePath("/");
  redirect("/admin/facilities");
}

export async function deleteFacilityAction(
  facilityId: number,
): Promise<FacilityActionResult | never> {
  const guard = await requireSuper();
  if (!guard.ok) {
    return { ok: false, kind: "forbidden", message: guard.message };
  }
  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin
    .from("facilities")
    .select("id, code, name, deleted_at")
    .eq("id", facilityId)
    .maybeSingle<{
      id: number;
      code: string;
      name: string;
      deleted_at: string | null;
    }>();
  if (!existing) {
    return {
      ok: false,
      kind: "not_found",
      message: "対象の館が見つかりません。",
    };
  }
  if (existing.deleted_at) {
    // 既に削除済み: 冪等に成功扱い。
    revalidatePath("/admin/facilities");
    return { ok: true };
  }

  const { error } = await admin
    .from("facilities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", facilityId);

  if (error) {
    console.error("[admin.facilities.delete] soft delete failed", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      kind: "unknown",
      message: "館の削除に失敗しました。\nもう一度お試しください。",
    };
  }

  await logAdminAction({
    adminId: guard.adminId,
    action: "facility.delete",
    targetType: "facility",
    targetId: String(facilityId),
    metadata: { code: existing.code, name: existing.name },
  });

  revalidatePath("/admin/facilities");
  revalidatePath("/admin/clubs");
  revalidatePath("/");
  return { ok: true };
}
