"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginActionResult = { ok: false; message: string };

/**
 * 管理者ログイン。Supabase Auth の email / password で認証し、成功時は
 * `next` が `/admin*` に限り OK のリダイレクト先として採用する（Open
 * Redirect 防止、security-review §3）。失敗時は汎用メッセージを返し、
 * 「メールが存在しない」/「パスワード違い」を区別しない（ユーザー列挙対策）。
 *
 * 戻り値は失敗時のみで、成功時は `redirect()` が throw するので関数から
 * 戻ることは無い。呼び出し元では `if (result && !result.ok) ...` で扱う。
 */
export async function loginAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<LoginActionResult | never> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    return {
      ok: false,
      message:
        "メールアドレスまたはパスワードが正しくありません。\nもう一度ご確認ください。",
    };
  }

  // next は `/admin*` の相対パスだけ許可（Open Redirect 防止）。
  // 旧ダッシュボード `/admin` に戻そうとした場合は `/admin/clubs` に寄せる
  // （ログイン後の初期画面はクラブ一覧）。
  const isSafeAdminPath =
    typeof input.next === "string" && /^\/admin(\/.*)?$/.test(input.next);
  const target =
    !isSafeAdminPath || input.next === "/admin" ? "/admin/clubs" : input.next!;
  redirect(target);
}
