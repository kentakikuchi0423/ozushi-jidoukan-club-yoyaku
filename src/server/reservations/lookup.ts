import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFacilityCode, type FacilityCode } from "@/lib/facility";
import type { ReservationStatus } from "@/lib/reservations/status";

export interface ReservationDetail {
  readonly reservationNumber: string;
  readonly status: ReservationStatus;
  readonly waitlistPosition: number | null;
  readonly parentName: string;
  readonly parentKana: string;
  readonly childName: string;
  readonly childKana: string;
  readonly phone: string;
  readonly email: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly canceledAt: string | null;
  readonly club: {
    readonly id: string;
    readonly name: string;
    readonly facilityCode: FacilityCode;
    readonly facilityName: string;
    readonly startAt: string;
    readonly endAt: string;
  };
}

interface GetMyReservationRow {
  reservation_number: string;
  status: ReservationStatus;
  waitlist_position: number | null;
  parent_name: string;
  parent_kana: string;
  child_name: string;
  child_kana: string;
  phone: string;
  email: string;
  notes: string | null;
  created_at: string;
  canceled_at: string | null;
  club_id: string;
  club_name: string;
  facility_code: string;
  facility_name: string;
  start_at: string;
  end_at: string;
}

/**
 * 予約番号 + secure_token を両方検証しつつ、予約とそのクラブ情報を取得する。
 * 一致する予約が無ければ null を返す（キャンセル済み予約も status='canceled'
 * として返るため、削除済みや token 不一致とは区別される）。
 */
export async function fetchMyReservation(
  reservationNumber: string,
  secureToken: string,
): Promise<ReservationDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_reservation", {
    p_reservation_number: reservationNumber,
    p_secure_token: secureToken,
  });
  if (error) {
    throw new Error(`failed to fetch reservation: ${error.message}`);
  }

  const rows = (data ?? []) as GetMyReservationRow[];
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!isFacilityCode(row.facility_code)) return null;

  return {
    reservationNumber: row.reservation_number,
    status: row.status,
    waitlistPosition: row.waitlist_position,
    parentName: row.parent_name,
    parentKana: row.parent_kana,
    childName: row.child_name,
    childKana: row.child_kana,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    createdAt: row.created_at,
    canceledAt: row.canceled_at,
    club: {
      id: row.club_id,
      name: row.club_name,
      facilityCode: row.facility_code,
      facilityName: row.facility_name,
      startAt: row.start_at,
      endAt: row.end_at,
    },
  };
}
