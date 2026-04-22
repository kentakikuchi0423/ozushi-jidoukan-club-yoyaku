import "server-only";

import { getSupabaseAdminClient } from "@/server/supabase/admin";

export interface AdminProfile {
  readonly id: string;
  readonly displayName: string | null;
}

/**
 * admin の表示名を取得する。存在しない（auth.users にあっても admins に未登録）
 * の場合は null。Supabase Studio で bootstrap 直後は display_name が null の
 * ことがあるので呼び出し側は fallback を用意すること。
 */
export async function fetchAdminProfile(
  adminId: string,
): Promise<AdminProfile | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("admins")
    .select("id, display_name")
    .eq("id", adminId)
    .maybeSingle();

  if (error) {
    throw new Error(`failed to fetch admin profile: ${error.message}`);
  }
  if (!data) return null;
  return { id: data.id, displayName: data.display_name };
}
