// 管理者パスワードの最低強度。
// ログイン・パスワード変更・新規アカウント作成で共通のポリシーを使う。

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_HINT =
  "8 文字以上。英字と数字を 1 文字以上含めてください。";

export const PASSWORD_ERROR =
  "パスワードは 8 文字以上で、英字と数字を 1 文字以上含めてください。";

/** 複雑性要件: 8 文字以上 + 英字 1 + 数字 1。 */
export function isPasswordStrong(pw: string): boolean {
  if (typeof pw !== "string") return false;
  if (pw.length < MIN_PASSWORD_LENGTH) return false;
  return /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}
