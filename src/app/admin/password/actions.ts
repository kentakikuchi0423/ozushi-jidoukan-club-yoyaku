"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/server/audit/log";

export type PasswordChangeResult =
  | { ok: true }
  | { ok: false; kind: "mismatch"; message: string }
  | { ok: false; kind: "weak"; message: string }
  | { ok: false; kind: "unauthenticated"; message: string }
  | { ok: false; kind: "current_wrong"; message: string }
  | { ok: false; kind: "update_failed"; message: string };

const MIN_PASSWORD_LENGTH = 10;

function isComplexEnough(pw: string): boolean {
  if (pw.length < MIN_PASSWORD_LENGTH) return false;
  // 英字のみは弱いので数字 or 記号を最低 1 文字要求
  return /[^A-Za-z]/.test(pw);
}

/**
 * 管理者パスワード変更。
 *   1. 現在のパスワードで再認証（`signInWithPassword`）して本人確認
 *   2. 新パスワードの複雑性を軽くチェック（10 文字以上 + 英字以外を含む）
 *   3. `supabase.auth.updateUser` で更新
 *   4. 監査ログに `admin.password_change` を記録
 */
export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<PasswordChangeResult> {
  if (input.newPassword !== input.confirmPassword) {
    return {
      ok: false,
      kind: "mismatch",
      message: "新しいパスワードと確認用パスワードが一致しません。",
    };
  }
  if (!isComplexEnough(input.newPassword)) {
    return {
      ok: false,
      kind: "weak",
      message: `新しいパスワードは ${MIN_PASSWORD_LENGTH} 文字以上で、英字以外（数字・記号）を 1 文字以上含めてください。`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !userData.user.email) {
    return {
      ok: false,
      kind: "unauthenticated",
      message: "セッションが切れています。再度ログインしてください。",
    };
  }

  // 本人確認のため、現在のパスワードで signInWithPassword を呼ぶ
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: input.currentPassword,
  });
  if (reauthError) {
    return {
      ok: false,
      kind: "current_wrong",
      message: "現在のパスワードが正しくありません。",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: input.newPassword,
  });
  if (updateError) {
    return {
      ok: false,
      kind: "update_failed",
      message:
        "パスワードの更新に失敗しました。しばらくしてからもう一度お試しください。",
    };
  }

  await logAdminAction({
    adminId: userData.user.id,
    action: "admin.password_change",
    targetType: "admin",
    targetId: userData.user.id,
  });

  return { ok: true };
}
