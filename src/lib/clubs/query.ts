import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFacilityCode } from "@/lib/facility";
import type { ClubListing } from "./types";

interface ListPublicClubsRow {
  id: string;
  facility_code: string;
  facility_name: string;
  program_id: string;
  name: string;
  target_age: string;
  summary: string;
  start_at: string;
  end_at: string;
  capacity: number;
  photo_url: string | null;
  description: string | null;
  published_at: string | null;
  confirmed_count: number;
  waitlisted_count: number;
}

function toClubListing(row: ListPublicClubsRow): ClubListing | null {
  if (!isFacilityCode(row.facility_code)) return null;
  return {
    id: row.id,
    facilityCode: row.facility_code,
    facilityName: row.facility_name,
    programId: row.program_id,
    name: row.name,
    targetAge: row.target_age,
    summary: row.summary,
    startAt: row.start_at,
    endAt: row.end_at,
    capacity: row.capacity,
    photoUrl: row.photo_url,
    description: row.description,
    publishedAt: row.published_at,
    confirmedCount: row.confirmed_count,
    waitlistedCount: row.waitlisted_count,
  };
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
  return rows
    .map(toClubListing)
    .filter((row): row is ClubListing => row !== null);
}

/**
 * 単一クラブの詳細を `get_public_club(id)` RPC 経由で取得する。
 * 該当が無い（削除済み／1 年以上前／存在しない id）場合は null を返す。
 */
export async function fetchClubDetail(id: string): Promise<ClubListing | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_club", {
    p_id: id,
  });
  if (error) {
    throw new Error(`failed to fetch club detail: ${error.message}`);
  }

  const rows = (data ?? []) as ListPublicClubsRow[];
  if (rows.length === 0) return null;
  return toClubListing(rows[0]);
}
