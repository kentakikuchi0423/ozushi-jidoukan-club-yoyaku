"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 管理者ログアウト。Supabase のセッション cookie を破棄して `/admin/login`
 * へリダイレクトする。Middleware が次のアクセスで再度ログイン画面に送る。
 */
export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
