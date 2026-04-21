import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFacilityCode } from "@/lib/facility";
import type { ClubListing } from "./types";

interface ListPublicClubsRow {
  id: string;
  facility_code: string;
  facility_name: string;
  name: string;
  start_at: string;
  end_at: string;
  capacity: number;
  target_age_min: number | null;
  target_age_max: number | null;
  photo_url: string | null;
  description: string | null;
  confirmed_count: number;
  waitlisted_count: number;
}

/**
 * 公開クラブ一覧を `list_public_clubs` RPC 経由で取得する。
 *
 * RPC 側が「deleted_at is null かつ start_at >= now() - 1 year」で絞り、
 * start_at desc で並べる。anon / authenticated どちらからでも呼べる。
 */
export async function fetchListableClubs(): Promise<ClubListing[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_public_clubs");
  if (error) {
    throw new Error(`failed to list clubs: ${error.message}`);
  }

  const rows = (data ?? []) as ListPublicClubsRow[];
  const clubs: ClubListing[] = [];
  for (const row of rows) {
    if (!isFacilityCode(row.facility_code)) continue;
    clubs.push({
      id: row.id,
      facilityCode: row.facility_code,
      facilityName: row.facility_name,
      name: row.name,
      startAt: row.start_at,
      endAt: row.end_at,
      capacity: row.capacity,
      targetAgeMin: row.target_age_min,
      targetAgeMax: row.target_age_max,
      photoUrl: row.photo_url,
      description: row.description,
      confirmedCount: row.confirmed_count,
      waitlistedCount: row.waitlisted_count,
    });
  }
  return clubs;
}
