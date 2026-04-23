"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { programInputSchema } from "@/lib/clubs/input-schema";
import { logAdminAction } from "@/server/audit/log";
import { requireAdmin } from "@/server/auth/guards";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

// クラブ・事業マスター（club_programs）の CRUD。
//   * 任意の admin が CRUD 可能（館の権限に関わらない）
//   * 書き込み後に監査ログを残す
//   * 削除はソフト削除（deleted_at をセット）。既存クラブが参照していても許容し、
//     ドロップダウンからは除外される。
//   * 名前は unique 制約。衝突は日本語メッセージで返す。

export type ProgramActionResult =
  | { ok: true }
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
    return "同じ名前のクラブ・事業が既に登録されています。";
  }
  return null;
}

export async function createProgramAction(
  rawInput: unknown,
): Promise<ProgramActionResult | never> {
  const ctx = await requireAdmin();
  const parsed = programInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "input",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }
  const input = parsed.data;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("club_programs")
    .insert({
      name: input.name,
      target_age: input.targetAge,
      summary: input.summary,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("[admin.programs.create] insert failed", {
      code: error?.code,
      message: error?.message,
    });
    const dupMsg = translateUniqueViolation(error);
    if (dupMsg) {
      return {
        ok: false,
        kind: "input",
        fieldErrors: { name: dupMsg },
      };
    }
    return {
      ok: false,
      kind: "unknown",
      message: "クラブ・事業の登録に失敗しました。\nもう一度お試しください。",
    };
  }

  await logAdminAction({
    adminId: ctx.adminId,
    action: "program.create",
    targetType: "program",
    targetId: data.id,
    metadata: { name: input.name },
  });

  revalidatePath("/admin/programs");
  revalidatePath("/admin/clubs");
  revalidatePath("/");
  redirect("/admin/programs");
}

export async function updateProgramAction(
  programId: string,
  rawInput: unknown,
): Promise<ProgramActionResult | never> {
  const ctx = await requireAdmin();
  const parsed = programInputSchema.safeParse(rawInput);
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
    .from("club_programs")
    .select("id, name")
    .eq("id", programId)
    .maybeSingle<{ id: string; name: string }>();
  if (!existing) {
    return {
      ok: false,
      kind: "not_found",
      message: "対象のクラブ・事業が見つかりません。",
    };
  }

  const { error } = await admin
    .from("club_programs")
    .update({
      name: input.name,
      target_age: input.targetAge,
      summary: input.summary,
    })
    .eq("id", programId);
  if (error) {
    console.error("[admin.programs.update] update failed", {
      code: error.code,
      message: error.message,
    });
    const dupMsg = translateUniqueViolation(error);
    if (dupMsg) {
      return {
        ok: false,
        kind: "input",
        fieldErrors: { name: dupMsg },
      };
    }
    return {
      ok: false,
      kind: "unknown",
      message: "クラブ・事業の更新に失敗しました。\nもう一度お試しください。",
    };
  }

  await logAdminAction({
    adminId: ctx.adminId,
    action: "program.update",
    targetType: "program",
    targetId: programId,
    metadata: { nameBefore: existing.name, nameAfter: input.name },
  });

  revalidatePath("/admin/programs");
  revalidatePath("/admin/clubs");
  revalidatePath("/");
  redirect("/admin/programs");
}

/**
 * ソフト削除。既存クラブが参照していてもフォームのドロップダウンからは
 * 除外され、画面表示は JOIN で残り続ける。
 */
export async function deleteProgramAction(
  programId: string,
): Promise<ProgramActionResult | never> {
  const ctx = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin
    .from("club_programs")
    .select("id, name, deleted_at")
    .eq("id", programId)
    .maybeSingle<{ id: string; name: string; deleted_at: string | null }>();
  if (!existing) {
    return {
      ok: false,
      kind: "not_found",
      message: "対象のクラブ・事業が見つかりません。",
    };
  }
  if (existing.deleted_at) {
    // 既に削除済み: 何もしないで成功扱い
    revalidatePath("/admin/programs");
    return { ok: true };
  }

  const { error } = await admin
    .from("club_programs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", programId);
  if (error) {
    console.error("[admin.programs.delete] soft delete failed", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      kind: "unknown",
      message: "クラブ・事業の削除に失敗しました。\nもう一度お試しください。",
    };
  }

  await logAdminAction({
    adminId: ctx.adminId,
    action: "program.delete",
    targetType: "program",
    targetId: programId,
    metadata: { name: existing.name },
  });

  revalidatePath("/admin/programs");
  revalidatePath("/admin/clubs");
  revalidatePath("/");
  return { ok: true };
}
