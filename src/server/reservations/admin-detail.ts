import "server-only";

import { isFacilityCodeFormat, type FacilityCode } from "@/lib/facility";
import type { ReservationStatus } from "@/lib/reservations/status";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export interface AdminReservationPerson {
  readonly name: string;
  readonly kana: string;
}

export interface AdminReservationDetail {
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
  readonly club: {
    readonly id: string;
    readonly facilityCode: FacilityCode;
    readonly facilityName: string;
    readonly programName: string;
    readonly startAt: string;
    readonly endAt: string;
    readonly capacity: number;
  };
}

interface AdminReservationDetailRow {
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
  club: {
    id: string;
    start_at: string;
    end_at: string;
    capacity: number;
    deleted_at: string | null;
    facility: { code: string; name: string };
    program: { name: string };
  };
}

/**
 * 管理画面のキャンセル確認ページ等で使う、予約 1 件の詳細取得。
 * クラブ・館・プログラム・保護者・子どもまで 1 クエリで引き、
 * 呼び出し側で `club.facilityCode` を使って権限チェックする前提。
 *
 * クラブが soft-delete 済みの場合は null を返す（管理者でも操作不可）。
 */
export async function fetchAdminReservationDetail(
  reservationId: string,
): Promise<AdminReservationDetail | null> {
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
       children:reservation_children(name, kana, position),
       club:clubs!inner(
         id,
         start_at,
         end_at,
         capacity,
         deleted_at,
         facility:facilities!inner(code, name),
         program:club_programs!inner(name)
       )`,
    )
    .eq("id", reservationId)
    .maybeSingle<AdminReservationDetailRow>();

  if (error) {
    throw new Error(`failed to fetch reservation detail: ${error.message}`);
  }
  if (!data) return null;
  if (data.club.deleted_at) return null;
  if (!isFacilityCodeFormat(data.club.facility.code)) return null;

  return {
    id: data.id,
    reservationNumber: data.reservation_number,
    status: data.status,
    waitlistPosition: data.waitlist_position,
    createdAt: data.created_at,
    canceledAt: data.canceled_at,
    phone: data.phone,
    email: data.email,
    notes: data.notes,
    parents: (data.parents ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ name: p.name, kana: p.kana })),
    children: (data.children ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ name: p.name, kana: p.kana })),
    club: {
      id: data.club.id,
      facilityCode: data.club.facility.code,
      facilityName: data.club.facility.name,
      programName: data.club.program.name,
      startAt: data.club.start_at,
      endAt: data.club.end_at,
      capacity: data.club.capacity,
    },
  };
}
