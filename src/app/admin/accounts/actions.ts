"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  FACILITY_CODES,
  FACILITY_ID_BY_CODE,
  type FacilityCode,
} from "@/lib/facility";
import { logAdminAction } from "@/server/audit/log";
import {
  requireSuperAdmin,
  SuperAdminRequiredError,
} from "@/server/auth/guards";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export type AddAdminResult =
  | { ok: true }
  | { ok: false; kind: "forbidden"; message: string }
  | { ok: false; kind: "input"; fieldErrors: Record<string, string> }
  | { ok: false; kind: "invite_failed"; message: string }
  | { ok: false; kind: "unknown"; message: string };

const facilityCodeSchema = z.enum(
  FACILITY_CODES as unknown as [FacilityCode, ...FacilityCode[]],
  { message: "館の指定が正しくありません" },
);

const addAdminSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "メールアドレスの形式が正しくありません" })
    .max(320, { message: "メールアドレスが長すぎます" }),
  displayName: z
    .string()
    .trim()
    .max(100, { message: "表示名は 100 字以内で入力してください" })
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  facilityCodes: z
    .array(facilityCodeSchema)
    .min(1, { message: "館を 1 つ以上選択してください" })
    .max(3, { message: "館は最大 3 つまでです" }),
});

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

/**
 * Supabase Auth の招待エラー（英語）をユーザ向け日本語メッセージに変換する。
 * 元の `error.message` をそのまま画面に出すと英語が露出するため、既知のパターンを
 * マップし、それ以外は汎用の日本語メッセージにフォールバックする。
 */
function translateInviteError(error: { message?: string } | null): string {
  const raw = error?.message?.toLowerCase() ?? "";
  if (
    raw.includes("already been registered") ||
    raw.includes("already exists")
  ) {
    return "このメールアドレスは既に登録済みです。\n別のアドレスを指定するか、該当ユーザーにパスワードの再設定をご案内ください。";
  }
  if (raw.includes("invalid") && raw.includes("email")) {
    return "メールアドレスの形式が正しくありません。\nもう一度ご確認ください。";
  }
  if (raw.includes("rate") || raw.includes("too many")) {
    return "短時間に招待が集中しています。\nしばらく待ってからもう一度お試しください。";
  }
  return "招待メールの送信に失敗しました。\nメールアドレスやネットワーク状態を確認してから、もう一度お試しください。";
}

/**
 * super_admin による新規管理者招待。
 *   1. `supabase.auth.admin.inviteUserByEmail` で auth.users を作成し招待メール送信
 *   2. 返ってきた user.id で `admins` に INSERT
 *   3. 選択された館ぶんだけ `admin_facilities` に INSERT
 *   4. 監査ログに `admin.create` を記録
 *
 * 途中で失敗した場合は auth.users が取り残される可能性があるが、Supabase Studio
 * 側で「Authentication → Users」から該当ユーザを手動削除して再招待することで復旧できる。
 * 本格対応は Phase 6 で SECURITY DEFINER RPC 化する。
 */
export async function addAdminAction(
  rawInput: unknown,
): Promise<AddAdminResult> {
  let ctx;
  try {
    ctx = await requireSuperAdmin();
  } catch (error) {
    if (error instanceof SuperAdminRequiredError) {
      return {
        ok: false,
        kind: "forbidden",
        message: "この操作は全館管理者のみ実行できます。",
      };
    }
    throw error;
  }

  const parsed = addAdminSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "input",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }
  const input = parsed.data;

  const admin = getSupabaseAdminClient();

  // 1) 招待
  const { data: invite, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(input.email);
  if (inviteError || !invite.user) {
    console.error("[admin.accounts.create] invite failed", {
      message: inviteError?.message,
    });
    return {
      ok: false,
      kind: "invite_failed",
      message: translateInviteError(inviteError),
    };
  }
  const newUserId = invite.user.id;

  // 2) admins
  const { error: adminInsertError } = await admin
    .from("admins")
    .insert({ id: newUserId, display_name: input.displayName });
  if (adminInsertError) {
    console.error("[admin.accounts.create] admins insert failed", {
      code: adminInsertError.code,
      message: adminInsertError.message,
    });
    return {
      ok: false,
      kind: "unknown",
      message:
        "内部エラー: 招待は送信されましたが、admin プロフィール作成に失敗しました。\nSupabase Studio から手動で確認してください。",
    };
  }

  // 3) admin_facilities
  const { error: afError } = await admin.from("admin_facilities").insert(
    input.facilityCodes.map((code) => ({
      admin_id: newUserId,
      facility_id: FACILITY_ID_BY_CODE[code],
    })),
  );
  if (afError) {
    console.error("[admin.accounts.create] admin_facilities insert failed", {
      code: afError.code,
      message: afError.message,
    });
    return {
      ok: false,
      kind: "unknown",
      message:
        "内部エラー: 招待は送信されましたが、館権限の付与に失敗しました。\nSupabase Studio から手動で確認してください。",
    };
  }

  // 4) Audit log
  await logAdminAction({
    adminId: ctx.adminId,
    action: "admin.create",
    targetType: "admin",
    targetId: newUserId,
    metadata: {
      email: input.email,
      facilityCodes: input.facilityCodes,
    },
  });

  revalidatePath("/admin/accounts");
  return { ok: true };
}
