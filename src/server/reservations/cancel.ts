import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isReservationNumber } from "@/lib/reservations/number";
import type { ReservationStatus } from "@/lib/reservations/status";
import { isSecureTokenFormat } from "./secure-token";

export interface CancelReservationResult {
  /** すでに canceled 状態だった場合は false（no-op）。新たにキャンセルした場合は true。 */
  canceled: boolean;
  /** キャンセル前の status。idempotent 呼び出し時は 'canceled'。 */
  previousStatus: ReservationStatus;
  /** 元が confirmed で waitlist 先頭が繰り上がった場合、その予約番号。 */
  promotedReservationNumber: string | null;
  /** 同上の、繰り上がった予約のメールアドレス（繰り上げ通知メール送信用）。 */
  promotedEmail: string | null;
}

export class InvalidReservationIdentifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReservationIdentifierError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor() {
    super("reservation not found or token mismatch");
    this.name = "ReservationNotFoundError";
  }
}

interface CancelReservationRow {
  canceled: boolean;
  previous_status: ReservationStatus;
  promoted_reservation_number: string | null;
  promoted_email: string | null;
}

/**
 * 予約を（secure_token 検証のうえで）キャンセルする。
 *
 * - 同じ引数で 2 度呼んでも安全（2 回目は canceled=false の no-op）。
 * - 元が confirmed だった場合のみ、waitlist 先頭の予約を confirmed に繰り上げる。
 *   Node 側は戻り値の `promotedReservationNumber` / `promotedEmail` が non-null
 *   なら繰り上げ通知メールを送る運用。
 * - トークン不一致・存在しない予約番号は ReservationNotFoundError。
 */
export async function cancelReservation(
  reservationNumber: string,
  secureToken: string,
): Promise<CancelReservationResult> {
  if (!isReservationNumber(reservationNumber)) {
    throw new InvalidReservationIdentifierError(
      "reservation_number の形式が正しくありません。",
    );
  }
  if (!isSecureTokenFormat(secureToken)) {
    throw new InvalidReservationIdentifierError(
      "secure_token の形式が正しくありません。",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cancel_reservation", {
    p_reservation_number: reservationNumber,
    p_secure_token: secureToken,
  });

  if (error) {
    // PostgreSQL 側で `P0002 no_data_found` を raise している想定。
    if (error.code === "P0002") throw new ReservationNotFoundError();
    throw new Error(`cancel_reservation RPC failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : (data as CancelReservationRow);
  if (!row) throw new ReservationNotFoundError();

  return {
    canceled: row.canceled,
    previousStatus: row.previous_status,
    promotedReservationNumber: row.promoted_reservation_number,
    promotedEmail: row.promoted_email,
  };
}
