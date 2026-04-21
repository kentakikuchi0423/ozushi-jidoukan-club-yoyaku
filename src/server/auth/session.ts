import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// 現在のリクエストに紐づく admin の UUID（= auth.users.id）を返す。
// Supabase Auth セッションが無い / 不正な場合は null。
// 「セッションが有効である」ことまでを保証し、その uid が `admins` テーブルに
// 登録済みか・どの館の権限を持つかは上位層（`guards.ts`）で検証する。
export async function getCurrentAdminId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
