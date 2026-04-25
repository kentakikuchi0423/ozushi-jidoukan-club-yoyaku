"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { FACILITY_CODE_REGEX } from "@/lib/facility";
import { isPasswordStrong, PASSWORD_ERROR } from "@/lib/auth/password";
import { publicEnv } from "@/lib/env";
import { logAdminAction } from "@/server/audit/log";
import {
  requireSuperAdmin,
  SuperAdminRequiredError,
} from "@/server/auth/guards";
import { fetchFacilities } from "@/server/facilities/list";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import { renderAdminInviteEmail } from "@/server/mail/templates/admin-invite";
import { sendEmail } from "@/server/mail/send";

export type AddAdminResult =
  | { ok: true }
  | { ok: false; kind: "forbidden"; message: string }
  | { ok: false; kind: "input"; fieldErrors: Record<string, string> }
  | { ok: false; kind: "invite_failed"; message: string }
  | { ok: false; kind: "unknown"; message: string };

export type DeleteAdminResult =
  | { ok: true }
  | { ok: false; kind: "forbidden"; message: string }
  | { ok: false; kind: "not_found"; message: string }
  | { ok: false; kind: "self"; message: string }
  | { ok: false; kind: "unknown"; message: string };

const facilityCodeSchema = z
  .string()
  .regex(FACILITY_CODE_REGEX, { message: "館の指定が正しくありません" });

const addAdminSchema = z
  .object({
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
    password: z
      .string()
      .min(1, { message: "初期パスワードを入力してください" })
      .max(72, { message: "パスワードが長すぎます（72 字まで）" }),
    confirmPassword: z.string(),
    facilityCodes: z
      .array(facilityCodeSchema)
      .min(1, { message: "館を 1 つ以上選択してください" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  })
  .refine((data) => isPasswordStrong(data.password), {
    message: PASSWORD_ERROR,
    path: ["password"],
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
 * Supabase Auth の管理 API エラーをユーザ向け日本語メッセージに変換する。
 * 画面に英語を露出させないため、既知パターンを日本語にマップする。
 */
function translateAdminError(error: { message?: string } | null): string {
  const raw = error?.message?.toLowerCase() ?? "";
  if (
    raw.includes("already been registered") ||
    raw.includes("already exists") ||
    raw.includes("duplicate key")
  ) {
    return "このメールアドレスは既に登録済みです。\n別のアドレスを指定するか、該当ユーザーにパスワードの再設定をご案内ください。";
  }
  if (raw.includes("invalid") && raw.includes("email")) {
    return "メールアドレスの形式が正しくありません。\nもう一度ご確認ください。";
  }
  if (raw.includes("password")) {
    return "パスワードが Supabase のポリシーを満たしていません。\n8 文字以上で、英字と数字を 1 文字以上含めて再度お試しください。";
  }
  if (raw.includes("rate") || raw.includes("too many")) {
    return "短時間にリクエストが集中しています。\nしばらく待ってからもう一度お試しください。";
  }
  return "管理者アカウントの作成に失敗しました。\n入力内容・ネットワーク状態を確認し、もう一度お試しください。";
}

/**
 * 全館管理者による新規管理者追加。
 *   1. `admin.createUser` でパスワード付きユーザを作成（email 未確認）
 *   2. `admins` + `admin_facilities` にプロフィール・館権限を挿入
 *   3. `admin.generateLink(type='signup')` で確認用リンクを生成
 *   4. Resend で日本語の招待メールを送信
 *   5. 監査ログに `admin.create` を記録
 *
 * 招待メール内のリンクをクリックすると `/auth/callback?code=...&next=/admin/clubs`
 * に到達し、email 確認 + セッション発行がまとめて行われる。
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

  // 選択された館が有効な（非削除）館として存在することを確認する。
  const activeFacilities = await fetchFacilities({ includeDeleted: false });
  const facilityByCode = new Map(activeFacilities.map((f) => [f.code, f]));
  const unknownCodes = input.facilityCodes.filter(
    (code) => !facilityByCode.has(code),
  );
  if (unknownCodes.length > 0) {
    return {
      ok: false,
      kind: "input",
      fieldErrors: {
        facilityCodes:
          "選択された館が見つかりませんでした。画面を再読み込みしてからもう一度お試しください。",
      },
    };
  }

  // 1) email 未確認の状態で auth.users を作成（パスワードも保存される）
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: false,
    });
  if (createError || !created.user) {
    console.error("[admin.accounts.create] createUser failed", {
      code: createError?.code,
      message: createError?.message,
    });
    return {
      ok: false,
      kind: "invite_failed",
      message: translateAdminError(createError),
    };
  }
  const newUserId = created.user.id;

  // 2) admins + admin_facilities を同トランザクションで作成したいところだが、
  //    supabase-js v2 にはトランザクション境界が無いので順番に insert する。
  //    失敗した場合は Supabase Studio からユーザを削除して再実行する運用でカバー。
  const { error: adminInsertError } = await admin
    .from("admins")
    .insert({ id: newUserId, display_name: input.displayName });
  if (adminInsertError) {
    console.error("[admin.accounts.create] admins insert failed", {
      code: adminInsertError.code,
      message: adminInsertError.message,
    });
    // ロールバック: 作った auth.users を巻き戻す
    await admin.auth.admin.deleteUser(newUserId).catch(() => undefined);
    return {
      ok: false,
      kind: "unknown",
      message:
        "管理者プロフィールの作成に失敗しました。\nもう一度お試しください（作成途中のユーザは自動的に削除しました）。",
    };
  }

  const { error: afError } = await admin.from("admin_facilities").insert(
    input.facilityCodes.map((code) => ({
      admin_id: newUserId,
      facility_id: facilityByCode.get(code)!.id,
    })),
  );
  if (afError) {
    console.error("[admin.accounts.create] admin_facilities insert failed", {
      code: afError.code,
      message: afError.message,
    });
    // ロールバック: admins → auth.users（cascade 削除に任せる）
    await admin.auth.admin.deleteUser(newUserId).catch(() => undefined);
    return {
      ok: false,
      kind: "unknown",
      message:
        "館権限の付与に失敗しました。\nもう一度お試しください（作成途中のユーザは自動的に削除しました）。",
    };
  }

  // 3) 確認リンクを生成（signup 型はパスワード設定済みユーザの email 確認に使える）
  const redirectTo = `${publicEnv.siteUrl.replace(/\/$/, "")}/auth/callback?next=/admin/clubs`;
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "signup",
      email: input.email,
      password: input.password,
      options: { redirectTo },
    });
  const actionLink = linkData?.properties?.action_link ?? null;
  if (linkError || !actionLink) {
    console.error("[admin.accounts.create] generateLink failed", {
      code: linkError?.code,
      message: linkError?.message,
    });
    // ユーザ・関係レコードは作成済みだが、確認リンクが無いとログインできない。
    // このケースは稀なので手動対応できるようログに詳細を残し、UI には日本語で通知。
    return {
      ok: false,
      kind: "unknown",
      message:
        "ユーザ作成は完了しましたが、確認メールの生成に失敗しました。\n全館管理者にご相談ください（Supabase Studio から確認リンクを再発行できます）。",
    };
  }

  // 4) 日本語で招待メールを送る
  const facilityNames = input.facilityCodes.map(
    (code) => facilityByCode.get(code)!.name,
  );
  const footerFacilities = activeFacilities.map((f) => ({
    name: f.name,
    phone: f.phone,
  }));
  const email = renderAdminInviteEmail(
    {
      email: input.email,
      displayName: input.displayName,
      facilityNames,
      actionLink,
    },
    footerFacilities,
  );
  await sendEmail({
    tag: "admin.invite",
    to: input.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  // 5) 監査ログ
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

/**
 * 全館管理者による管理者の削除。
 * auth.users を消すと cascade で admins / admin_facilities も消え、
 * 監査ログ・クラブ作成者参照は `admin_id = NULL` に書き換わる（ADR 無し、
 * migration 20260423010000 で FK を `on delete set null` に変更済み）。
 */
export async function deleteAdminAction(
  targetAdminId: string,
): Promise<DeleteAdminResult> {
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

  if (ctx.adminId === targetAdminId) {
    return {
      ok: false,
      kind: "self",
      message:
        "自分自身のアカウントは削除できません。\n他の全館管理者に依頼してください。",
    };
  }

  const admin = getSupabaseAdminClient();
  const { data: existing } = await admin
    .from("admins")
    .select("id, display_name")
    .eq("id", targetAdminId)
    .maybeSingle<{ id: string; display_name: string | null }>();
  if (!existing) {
    return {
      ok: false,
      kind: "not_found",
      message: "対象の管理者が見つかりませんでした。",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(targetAdminId);
  if (error) {
    console.error("[admin.accounts.delete] deleteUser failed", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      kind: "unknown",
      message:
        "管理者の削除に失敗しました。\nしばらく経ってからもう一度お試しください。",
    };
  }

  await logAdminAction({
    adminId: ctx.adminId,
    action: "admin.delete",
    targetType: "admin",
    targetId: targetAdminId,
    metadata: {
      displayName: existing.display_name,
    },
  });

  revalidatePath("/admin/accounts");
  return { ok: true };
}
