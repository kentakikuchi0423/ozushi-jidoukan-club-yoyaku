import "server-only";

import { isFacilityCode, type FacilityCode } from "@/lib/facility";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export interface ClubForEdit {
  readonly id: string;
  readonly facilityCode: FacilityCode;
  readonly name: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly capacity: number;
  readonly targetAgeMin: number | null;
  readonly targetAgeMax: number | null;
  readonly photoUrl: string | null;
  readonly description: string | null;
}

interface AdminClubRow {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
  capacity: number;
  target_age_min: number | null;
  target_age_max: number | null;
  photo_url: string | null;
  description: string | null;
  deleted_at: string | null;
  facility: { code: string };
}

/**
 * admin 管理画面での編集用にクラブ 1 件を取得する。
 *   * 存在しない / ソフト削除済み / 許可館外 のいずれも null を返す
 *   * admin クライアント（secret key）で取得するため RLS の影響を受けない
 */
export async function fetchClubForAdmin(
  id: string,
  allowedFacilities: readonly FacilityCode[],
): Promise<ClubForEdit | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("clubs")
    .select(
      `id,
       name,
       start_at,
       end_at,
       capacity,
       target_age_min,
       target_age_max,
       photo_url,
       description,
       deleted_at,
       facility:facilities!inner(code)`,
    )
    .eq("id", id)
    .maybeSingle<AdminClubRow>();

  if (error) {
    throw new Error(`failed to fetch club for admin: ${error.message}`);
  }
  if (!data || data.deleted_at) return null;
  if (!isFacilityCode(data.facility.code)) return null;
  if (!allowedFacilities.includes(data.facility.code)) return null;

  return {
    id: data.id,
    facilityCode: data.facility.code,
    name: data.name,
    startAt: data.start_at,
    endAt: data.end_at,
    capacity: data.capacity,
    targetAgeMin: data.target_age_min,
    targetAgeMax: data.target_age_max,
    photoUrl: data.photo_url,
    description: data.description,
  };
}
