import "server-only";

import type { ReservationStatus } from "@/lib/reservations/status";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export interface AdminReservationPerson {
  readonly name: string;
  readonly kana: string;
}

export interface AdminReservationListItem {
  readonly id: string;
  readonly reservationNumber: string;
  readonly status: ReservationStatus;
  readonly waitlistPosition: number | null;
  readonly createdAt: string;
  readonly canceledAt: string | null;
  readonly phone: string;
  readonly email: string;
  readonly notes: string | null;
  readonly parents: ReadonlyArray<AdminReservationPerson>;
  readonly children: ReadonlyArray<AdminReservationPerson>;
}

interface AdminReservationRow {
  id: string;
  reservation_number: string;
  status: ReservationStatus;
  waitlist_position: number | null;
  created_at: string;
  canceled_at: string | null;
  phone: string;
  email: string;
  notes: string | null;
  parents: Array<{ name: string; kana: string; position: number }> | null;
  children: Array<{ name: string; kana: string; position: number }> | null;
}

/**
 * 管理画面の「予約者を見る」ページで使う予約一覧を、申込時間（created_at）昇順で
 * 取得する。admin client で RLS をバイパスし、関係テーブルから保護者・子どもも
 * 1 クエリで引く。ページ側は呼び出し前に `fetchClubForAdmin` で権限を検証する前提。
 */
export async function fetchClubReservationsForAdmin(
  clubId: string,
): Promise<AdminReservationListItem[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("reservations")
    .select(
      `id,
       reservation_number,
       status,
       waitlist_position,
       created_at,
       canceled_at,
       phone,
       email,
       notes,
       parents:reservation_parents(name, kana, position),
       children:reservation_children(name, kana, position)`,
    )
    .eq("club_id", clubId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`failed to list reservations for admin: ${error.message}`);
  }

  // supabase-js の型推論が JOIN を配列として落としてくるので unknown 経由で narrowing。
  const rows = (data ?? []) as unknown as AdminReservationRow[];

  return rows.map<AdminReservationListItem>((row) => ({
    id: row.id,
    reservationNumber: row.reservation_number,
    status: row.status,
    waitlistPosition: row.waitlist_position,
    createdAt: row.created_at,
    canceledAt: row.canceled_at,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    parents: (row.parents ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ name: p.name, kana: p.kana })),
    children: (row.children ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ name: p.name, kana: p.kana })),
  }));
}
