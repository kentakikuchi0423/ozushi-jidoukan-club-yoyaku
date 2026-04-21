import "server-only";

import {
  FACILITY_CODES,
  isFacilityCode,
  type FacilityCode,
} from "@/lib/facility";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

// 純粋ロジック（DB 非依存）
// --------------------------------------------------------------------------
// super_admin は「3 館すべての権限を持つ admin」（ADR-0007）。個別カラムは
// 持たず、権限集合から都度判定する。

export function computeIsSuperAdmin(
  facilities: readonly FacilityCode[],
): boolean {
  const owned = new Set<FacilityCode>(facilities);
  return FACILITY_CODES.every((code) => owned.has(code));
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
// 返却順は保証しない（判定側で Set 化して使う）。

interface FacilityCodeRow {
  code: string;
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
    .select("facilities!inner(code)")
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
      if (isFacilityCode(item.code)) codes.push(item.code);
    }
  }
  return codes;
}
