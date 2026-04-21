"use server";

import { revalidatePath } from "next/cache";

import {
  cancelReservation,
  InvalidReservationIdentifierError,
  ReservationNotFoundError,
} from "@/server/reservations/cancel";

export type CancelActionResult =
  | {
      ok: true;
      /** 元が confirmed で waitlist 先頭が繰り上がった場合、その予約番号。 */
      promotedReservationNumber: string | null;
    }
  | { ok: false; kind: "invalid"; message: string }
  | { ok: false; kind: "not_found"; message: string }
  | { ok: false; kind: "unknown"; message: string };

/**
 * 予約確認 URL 上の「キャンセルする」ボタンから呼ばれる Server Action。
 * 成功時は `/reservations` をキャッシュ無効化して、再読み込みで最新状態が
 * 見えるようにする。
 */
export async function cancelReservationAction(
  reservationNumber: string,
  secureToken: string,
): Promise<CancelActionResult> {
  try {
    const result = await cancelReservation(reservationNumber, secureToken);
    // キャッシュ無効化して、元の URL（?r=...&t=...）を再度開くと canceled が見える
    revalidatePath("/reservations");
    return {
      ok: true,
      promotedReservationNumber: result.promotedReservationNumber,
    };
  } catch (error) {
    if (error instanceof InvalidReservationIdentifierError) {
      return {
        ok: false,
        kind: "invalid",
        message: "URL の形式が正しくありません。",
      };
    }
    if (error instanceof ReservationNotFoundError) {
      return {
        ok: false,
        kind: "not_found",
        message: "予約が見つかりません。URL をもう一度ご確認ください。",
      };
    }
    return {
      ok: false,
      kind: "unknown",
      message:
        "予期しないエラーが発生しました。時間をおいて再度お試しください。",
    };
  }
}
