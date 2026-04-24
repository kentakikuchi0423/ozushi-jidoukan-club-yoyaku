import "server-only";

import { isFacilityCode, type FacilityCode } from "@/lib/facility";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export interface ClubForEdit {
  readonly id: string;
  readonly facilityCode: FacilityCode;
  readonly programId: string;
  readonly programName: string;
  readonly programDeletedAt: string | null;
  readonly startAt: string;
  readonly endAt: string;
  readonly capacity: number;
  readonly photoUrl: string | null;
  readonly description: string | null;
  readonly publishedAt: string | null;
}

interface AdminClubRow {
  id: string;
  start_at: string;
  end_at: string;
  capacity: number;
  photo_url: string | null;
  description: string | null;
  deleted_at: string | null;
  published_at: string | null;
  program_id: string;
  facility: { code: string };
  program: { name: string; deleted_at: string | null };
}

/**
 * admin 管理画面での編集用にクラブ 1 件を取得する。
 *   * 存在しない / ソフト削除済み / 許可館外 のいずれも null を返す
 *   * admin クライアント（secret key）で取得するため RLS の影響を受けない
 *   * クラブ名・対象年齢はマスター（club_programs）側から取るので `program_id` を返す
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
       start_at,
       end_at,
       capacity,
       photo_url,
       description,
       deleted_at,
       published_at,
       program_id,
       facility:facilities!inner(code),
       program:club_programs!inner(name, deleted_at)`,
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
    programId: data.program_id,
    programName: data.program.name,
    programDeletedAt: data.program.deleted_at,
    startAt: data.start_at,
    endAt: data.end_at,
    capacity: data.capacity,
    photoUrl: data.photo_url,
    description: data.description,
    publishedAt: data.published_at,
  };
}
