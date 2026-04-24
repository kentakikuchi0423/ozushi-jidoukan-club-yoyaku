import "server-only";

import { isFacilityCodeFormat } from "@/lib/facility";
import type { ClubListing } from "@/lib/clubs/types";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

interface AdminClubRow {
  id: string;
  start_at: string;
  end_at: string;
  capacity: number;
  photo_url: string | null;
  description: string | null;
  published_at: string | null;
  facility: { code: string; name: string };
  program: {
    id: string;
    name: string;
    target_age: string;
    summary: string;
  };
}

interface ReservationCountRow {
  club_id: string;
  status: string;
}

/**
 * 管理画面用のクラブ一覧。未公開（`published_at IS NULL`）のクラブも含めて返す。
 * admin クライアント（secret key）で RLS をバイパスし、1 年以内の未削除クラブを
 * `start_at desc` で列挙する。予約件数は 1 回の集計クエリで効率的に引く。
 */
export async function fetchAdminListableClubs(): Promise<ClubListing[]> {
  const admin = getSupabaseAdminClient();
  const oneYearAgoIso = new Date(
    Date.now() - 365 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await admin
    .from("clubs")
    .select(
      `id,
       start_at,
       end_at,
       capacity,
       photo_url,
       description,
       published_at,
       facility:facilities!inner(code, name),
       program:club_programs!inner(id, name, target_age, summary)`,
    )
    .is("deleted_at", null)
    .gte("start_at", oneYearAgoIso)
    .order("start_at", { ascending: false });

  if (error) {
    throw new Error(`failed to list admin clubs: ${error.message}`);
  }

  // supabase-js は JOIN を配列として型推論するので unknown 経由でナロウする。
  const rows = (data ?? []) as unknown as AdminClubRow[];
  if (rows.length === 0) return [];

  // 予約件数は 1 クエリで引いてメモリ側で集計する。
  const clubIds = rows.map((r) => r.id);
  const { data: countData, error: countError } = await admin
    .from("reservations")
    .select("club_id, status")
    .in("club_id", clubIds);
  if (countError) {
    throw new Error(`failed to aggregate reservations: ${countError.message}`);
  }

  const counts = new Map<string, { confirmed: number; waitlisted: number }>();
  for (const row of (countData ?? []) as ReservationCountRow[]) {
    const current = counts.get(row.club_id) ?? { confirmed: 0, waitlisted: 0 };
    if (row.status === "confirmed") current.confirmed += 1;
    else if (row.status === "waitlisted") current.waitlisted += 1;
    counts.set(row.club_id, current);
  }

  return rows
    .filter((r) => isFacilityCodeFormat(r.facility.code))
    .map<ClubListing>((r) => {
      const c = counts.get(r.id) ?? { confirmed: 0, waitlisted: 0 };
      return {
        id: r.id,
        facilityCode: r.facility.code as ClubListing["facilityCode"],
        facilityName: r.facility.name,
        programId: r.program.id,
        name: r.program.name,
        targetAge: r.program.target_age,
        summary: r.program.summary,
        startAt: r.start_at,
        endAt: r.end_at,
        capacity: r.capacity,
        photoUrl: r.photo_url,
        description: r.description,
        publishedAt: r.published_at,
        confirmedCount: c.confirmed,
        waitlistedCount: c.waitlisted,
      };
    });
}
