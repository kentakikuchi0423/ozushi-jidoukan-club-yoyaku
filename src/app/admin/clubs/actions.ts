"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { clubInputSchema } from "@/lib/clubs/input-schema";
import { FACILITY_ID_BY_CODE } from "@/lib/facility";
import { datetimeLocalJstToUtcIso } from "@/lib/format";
import {
  FacilityPermissionDeniedError,
  requireAdmin,
  requireFacilityPermission,
} from "@/server/auth/guards";
import { logAdminAction } from "@/server/audit/log";
import { fetchClubForAdmin } from "@/server/clubs/admin-detail";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

// 管理画面のクラブ CRUD Server Actions。
//   * 入力は zod スキーマで検証（Client 側と二重防御）
//   * `requireFacilityPermission` で対象館の権限を確認
//   * `admins` テーブルに所属した super_admin / 一般 admin のどちらも、
//     自分の館以外に対しては何も書けない
//   * 書き込み後は `logAdminAction` で監査ログを残す
//   * 成功時は `/admin/clubs` を revalidate してから redirect

export type ClubActionResult =
  | { ok: true }
  | { ok: false; kind: "input"; fieldErrors: Record<string, string> }
  | { ok: false; kind: "forbidden"; message: string }
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

/** 新規クラブを登録する。 */
export async function createClubAction(
  rawInput: unknown,
): Promise<ClubActionResult | never> {
  const parsed = clubInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "input",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }
  const input = parsed.data;

  let ctx;
  try {
    ctx = await requireFacilityPermission(input.facilityCode);
  } catch (error) {
    if (error instanceof FacilityPermissionDeniedError) {
      return {
        ok: false,
        kind: "forbidden",
        message: "この館に対する権限がありません。",
      };
    }
    throw error;
  }

  const admin = getSupabaseAdminClient();
  const startAtUtc = datetimeLocalJstToUtcIso(input.startAt);
  const endAtUtc = datetimeLocalJstToUtcIso(input.endAt);
  // 参照先プログラムが有効（soft delete されていない）か確認
  const { data: program, error: programError } = await admin
    .from("club_programs")
    .select("id, deleted_at")
    .eq("id", input.programId)
    .maybeSingle<{ id: string; deleted_at: string | null }>();
  if (programError || !program || program.deleted_at) {
    return {
      ok: false,
      kind: "input",
      fieldErrors: {
        programId: "選択したクラブ・事業が見つからないか、削除済みです。",
      },
    };
  }

  const { data, error } = await admin
    .from("clubs")
    .insert({
      facility_id: FACILITY_ID_BY_CODE[input.facilityCode],
      program_id: input.programId,
      start_at: startAtUtc,
      end_at: endAtUtc,
      capacity: input.capacity,
      photo_url: input.photoUrl,
      description: input.description,
      created_by: ctx.adminId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("[admin.clubs.create] insert failed", {
      code: error?.code,
      message: error?.message,
      hint: error?.hint,
    });
    return {
      ok: false,
      kind: "unknown",
      message:
        "クラブの登録に失敗しました。\n入力内容を確認してもう一度お試しください。",
    };
  }

  await logAdminAction({
    adminId: ctx.adminId,
    action: "club.create",
    targetType: "club",
    targetId: data.id,
    metadata: {
      facilityCode: input.facilityCode,
      programId: input.programId,
    },
  });

  revalidatePath("/admin/clubs");
  revalidatePath("/");
  redirect("/admin/clubs");
}

/** 既存クラブを更新する。 */
export async function updateClubAction(
  clubId: string,
  rawInput: unknown,
): Promise<ClubActionResult | never> {
  const parsed = clubInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "input",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }
  const input = parsed.data;

  let ctx;
  try {
    ctx = await requireFacilityPermission(input.facilityCode);
  } catch (error) {
    if (error instanceof FacilityPermissionDeniedError) {
      return {
        ok: false,
        kind: "forbidden",
        message: "この館に対する権限がありません。",
      };
    }
    throw error;
  }

  // 現在のクラブ所属が admin の許可館に含まれていることを確認（facility の付け替えは別ケース）
  const existing = await fetchClubForAdmin(clubId, ctx.facilities);
  if (!existing) {
    return {
      ok: false,
      kind: "not_found",
      message: "クラブが見つかりません。\n一覧からもう一度お試しください。",
    };
  }

  // facility を変更する場合は、変更先にも権限が必要（上の requireFacilityPermission で確認済み）。
  // 変更「元」の権限も持っていることを上の fetchClubForAdmin で保証。

  const admin = getSupabaseAdminClient();
  // 参照先プログラムが有効か確認（既存クラブが削除済みプログラムを持っていても、
  // 更新時には有効なプログラムへ差し替えられる運用）
  const { data: program, error: programError } = await admin
    .from("club_programs")
    .select("id, deleted_at")
    .eq("id", input.programId)
    .maybeSingle<{ id: string; deleted_at: string | null }>();
  if (programError || !program || program.deleted_at) {
    return {
      ok: false,
      kind: "input",
      fieldErrors: {
        programId: "選択したクラブ・事業が見つからないか、削除済みです。",
      },
    };
  }

  const { error } = await admin
    .from("clubs")
    .update({
      facility_id: FACILITY_ID_BY_CODE[input.facilityCode],
      program_id: input.programId,
      start_at: datetimeLocalJstToUtcIso(input.startAt),
      end_at: datetimeLocalJstToUtcIso(input.endAt),
      capacity: input.capacity,
      photo_url: input.photoUrl,
      description: input.description,
    })
    .eq("id", clubId);

  if (error) {
    console.error("[admin.clubs.update] update failed", {
      code: error.code,
      message: error.message,
      hint: error.hint,
    });
    return {
      ok: false,
      kind: "unknown",
      message: "クラブの更新に失敗しました。",
    };
  }

  await logAdminAction({
    adminId: ctx.adminId,
    action: "club.update",
    targetType: "club",
    targetId: clubId,
    metadata: {
      facilityCodeBefore: existing.facilityCode,
      facilityCodeAfter: input.facilityCode,
      programIdBefore: existing.programId,
      programIdAfter: input.programId,
    },
  });

  revalidatePath("/admin/clubs");
  revalidatePath("/");
  redirect("/admin/clubs");
}

/** クラブをソフト削除（deleted_at に now() をセット）。 */
export async function deleteClubAction(
  clubId: string,
): Promise<ClubActionResult | never> {
  const ctx = await requireAdmin();
  const existing = await fetchClubForAdmin(clubId, ctx.facilities);
  if (!existing) {
    return {
      ok: false,
      kind: "not_found",
      message: "クラブが見つからないか、権限がありません。",
    };
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("clubs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", clubId);

  if (error) {
    console.error("[admin.clubs.delete] soft delete failed", {
      code: error.code,
      message: error.message,
      hint: error.hint,
    });
    return {
      ok: false,
      kind: "unknown",
      message: "クラブの削除に失敗しました。",
    };
  }

  await logAdminAction({
    adminId: ctx.adminId,
    action: "club.delete",
    targetType: "club",
    targetId: clubId,
    metadata: {
      facilityCode: existing.facilityCode,
      programId: existing.programId,
    },
  });

  revalidatePath("/admin/clubs");
  revalidatePath("/");
  redirect("/admin/clubs");
}
