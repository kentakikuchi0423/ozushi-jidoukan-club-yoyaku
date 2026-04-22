"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginActionResult = { ok: false; message: string };

/**
 * 管理者ログイン。Supabase Auth の email / password で認証し、成功時は
 * `next` が `/admin*` に限り OK のリダイレクト先として採用する（Open
 * Redirect 防止、security-review §3）。失敗時は汎用メッセージを返し、
 * 「メールが存在しない」/「パスワード違い」を区別しない（ユーザー列挙対策）。
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
        "メールアドレスまたはパスワードが正しくありません。もう一度ご確認ください。",
    };
  }

  const target =
    input.next && /^\/admin(\/.*)?$/.test(input.next) ? input.next : "/admin";
  redirect(target);
}
