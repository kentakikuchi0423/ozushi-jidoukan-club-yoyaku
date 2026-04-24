import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFacilityCodeFormat, type FacilityCode } from "@/lib/facility";
import type { ReservationStatus } from "@/lib/reservations/status";

export interface ReservationPerson {
  readonly name: string;
  readonly kana: string;
}

export interface ReservationDetail {
  readonly reservationNumber: string;
  readonly status: ReservationStatus;
  readonly waitlistPosition: number | null;
  readonly parents: ReadonlyArray<ReservationPerson>;
  readonly children: ReadonlyArray<ReservationPerson>;
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
  parents: unknown;
  children: unknown;
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

function toPeople(raw: unknown): ReservationPerson[] {
  if (!Array.isArray(raw)) return [];
  const out: ReservationPerson[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { name?: unknown }).name === "string" &&
      typeof (item as { kana?: unknown }).kana === "string"
    ) {
      out.push({
        name: (item as { name: string }).name,
        kana: (item as { kana: string }).kana,
      });
    }
  }
  return out;
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
  if (!isFacilityCodeFormat(row.facility_code)) return null;

  return {
    reservationNumber: row.reservation_number,
    status: row.status,
    waitlistPosition: row.waitlist_position,
    parents: toPeople(row.parents),
    children: toPeople(row.children),
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
