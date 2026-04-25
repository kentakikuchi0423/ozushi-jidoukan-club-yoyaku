import "server-only";

import type { ReservationStatus } from "@/lib/reservations/status";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export interface AdminCancelReservationResult {
  /** すでに canceled 状態だった場合は false（no-op）。新たにキャンセルした場合は true。 */
  canceled: boolean;
  /** キャンセル前の status。idempotent 呼び出し時は 'canceled'。 */
  previousStatus: ReservationStatus;
  /** 元が confirmed で waitlist 先頭が繰り上がった場合、その予約番号。 */
  promotedReservationNumber: string | null;
  /** 同上の、繰り上がった予約のメールアドレス（繰り上げ通知メール送信用）。 */
  promotedEmail: string | null;
}

export class AdminReservationNotFoundError extends Error {
  constructor() {
    super("reservation not found");
    this.name = "AdminReservationNotFoundError";
  }
}

interface AdminCancelReservationRow {
  canceled: boolean;
  previous_status: ReservationStatus;
  promoted_reservation_number: string | null;
  promoted_email: string | null;
}

/**
 * 管理者画面からの予約キャンセル。
 *
 * - 認可（対象館の admin 権限）は呼び出し側（Server Action）で済んでいる前提。
 * - admin client（service_role）経由で `admin_cancel_reservation` RPC を呼ぶ。
 * - 同じ予約 id を 2 度呼ばれても idempotent（2 回目は canceled=false の no-op）。
 * - 元が confirmed だった場合のみ waitlist 先頭を繰り上げる。
 */
export async function adminCancelReservation(
  reservationId: string,
): Promise<AdminCancelReservationResult> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_cancel_reservation", {
    p_reservation_id: reservationId,
  });

  if (error) {
    if (error.code === "P0002") throw new AdminReservationNotFoundError();
    // PostgREST のエラー詳細（code / hint / details）も Vercel ログから追えるよう
    // 出力する。本番で「関数が見つかりません」(PGRST202) を切り分けるのに役立つ。
    console.error("[admin.reservation.cancel] supabase rpc error", {
      code: error.code,
      message: error.message,
      hint: error.hint,
      details: error.details,
    });
    throw new Error(
      `admin_cancel_reservation RPC failed: ${error.code ?? "?"} ${error.message}`,
    );
  }

  const row = Array.isArray(data)
    ? data[0]
    : (data as AdminCancelReservationRow);
  if (!row) throw new AdminReservationNotFoundError();

  return {
    canceled: row.canceled,
    previousStatus: row.previous_status,
    promotedReservationNumber: row.promoted_reservation_number,
    promotedEmail: row.promoted_email,
  };
}
