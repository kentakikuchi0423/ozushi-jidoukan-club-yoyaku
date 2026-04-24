import "server-only";

import { isFacilityCodeFormat, type FacilityCode } from "@/lib/facility";
import { countActiveFacilities } from "@/server/facilities/list";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

// super_admin は「非削除の全 facilities を担当している admin」（ADR-0007 の動的化版）。
// 館マスターが動的になった（管理画面から追加・削除できる）ため、現時点の有効館数を
// DB から取得して比較する。
// 館数が 0（全て soft-delete されている想定外ケース）のときは super_admin 判定も false。

/**
 * 有効館数を既に取得済みの場面で使える純粋関数版。
 * テストや、同一リクエスト内で有効館リストを別途取得している画面から呼ぶ。
 */
export function computeIsSuperAdminFromCount(
  facilities: readonly FacilityCode[],
  totalActive: number,
): boolean {
  if (totalActive <= 0) return false;
  const owned = new Set<FacilityCode>(facilities);
  // owned はログイン admin 自身の admin_facilities から派生した code 集合。
  // 削除済み館の code が紛れていても active と数が合わないので最終的には false になる。
  return owned.size >= totalActive;
}

export async function computeIsSuperAdmin(
  facilities: readonly FacilityCode[],
): Promise<boolean> {
  const total = await countActiveFacilities();
  return computeIsSuperAdminFromCount(facilities, total);
}

export function hasFacilityPermission(
  facilities: readonly FacilityCode[],
  target: FacilityCode,
): boolean {
  return facilities.includes(target);
}

// DB 問い合わせ
// --------------------------------------------------------------------------
// admin 側の RLS で自分の `admin_facilities` しか見えないが、ここでは権限
// 判定そのものを信頼できる形で行うために secret key 経由の admin クライアント
// を使い、RLS の影響を受けない状態で facility_code を取得する。
//
// 削除済み facility に紐づく admin_facilities 行は super_admin 判定で
// カウントされないよう `facilities.deleted_at is null` で絞る。

interface FacilityCodeRow {
  code: string;
  deleted_at: string | null;
}

interface AdminFacilityJoinRow {
  facilities: FacilityCodeRow | FacilityCodeRow[] | null;
}

export async function fetchAdminFacilityCodes(
  adminId: string,
): Promise<FacilityCode[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_facilities")
    .select("facilities!inner(code, deleted_at)")
    .eq("admin_id", adminId);

  if (error) {
    throw new Error(`failed to fetch admin facility codes: ${error.message}`);
  }

  const rows = (data ?? []) as AdminFacilityJoinRow[];
  const codes: FacilityCode[] = [];
  for (const row of rows) {
    const joined = row.facilities;
    if (!joined) continue;
    const items = Array.isArray(joined) ? joined : [joined];
    for (const item of items) {
      if (item.deleted_at) continue;
      if (isFacilityCodeFormat(item.code)) codes.push(item.code);
    }
  }
  return codes;
}
