"use server";

import { revalidatePath } from "next/cache";

import { cancellationBlockedReason } from "@/lib/reservations/cancellation-deadline";
import {
  notifyReservationCanceled,
  notifyReservationPromoted,
} from "@/server/mail/notify";
import {
  cancelReservation,
  InvalidReservationIdentifierError,
  ReservationNotFoundError,
} from "@/server/reservations/cancel";
import { fetchMyReservation } from "@/server/reservations/lookup";

export type CancelActionResult =
  | {
      ok: true;
      /** 元が confirmed で waitlist 先頭が繰り上がった場合、その予約番号。 */
      promotedReservationNumber: string | null;
    }
  | { ok: false; kind: "invalid"; message: string }
  | { ok: false; kind: "not_found"; message: string }
  | { ok: false; kind: "deadline_passed"; message: string }
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
  // 通知用に事前にキャンセル前の情報を取っておく（キャンセル後は secure_token 経由
  // で再取得できない可能性もあるため）
  const beforeCancel = await fetchMyReservation(
    reservationNumber,
    secureToken,
  ).catch(() => null);

  // 開催日時を過ぎている / 締切を過ぎている場合は RPC を叩かず理由別に止める
  if (beforeCancel) {
    const blocked = cancellationBlockedReason(beforeCancel.club.startAt);
    if (blocked === "event-started") {
      return {
        ok: false,
        kind: "deadline_passed",
        message:
          "開催日時を過ぎているため、キャンセルできません。\n各館へ直接ご連絡ください。",
      };
    }
    if (blocked === "past-deadline") {
      return {
        ok: false,
        kind: "deadline_passed",
        message: "キャンセル期限を過ぎています。\n各館へ直接ご連絡ください。",
      };
    }
  }

  try {
    const result = await cancelReservation(reservationNumber, secureToken);
    // キャッシュ無効化して、元の URL（?r=...&t=...）を再度開くと canceled が見える
    revalidatePath("/reservations");

    // キャンセル確認メール（fire-and-forget）
    if (result.canceled && beforeCancel) {
      try {
        await notifyReservationCanceled({
          reservationNumber: beforeCancel.reservationNumber,
          parentName: beforeCancel.parents[0]?.name ?? "ご予約者",
          email: beforeCancel.email,
          facilityName: beforeCancel.club.facilityName,
          clubName: beforeCancel.club.name,
          clubStartAt: beforeCancel.club.startAt,
          clubEndAt: beforeCancel.club.endAt,
        });
      } catch (mailError) {
        console.error("[mail] notifyReservationCanceled failed", {
          tag: "reservation.canceled",
          error:
            mailError instanceof Error ? mailError.message : String(mailError),
        });
      }
    }

    // 繰り上げ通知メール（相手は別人なので admin client 経由で取得して送る）
    if (result.promotedReservationNumber) {
      try {
        await notifyReservationPromoted(result.promotedReservationNumber);
      } catch (mailError) {
        console.error("[mail] notifyReservationPromoted failed", {
          tag: "reservation.promoted",
          error:
            mailError instanceof Error ? mailError.message : String(mailError),
        });
      }
    }

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
        message: "予約が見つかりません。\nURL をもう一度ご確認ください。",
      };
    }
    return {
      ok: false,
      kind: "unknown",
      message:
        "予期しないエラーが発生しました。\n時間をおいて再度お試しください。",
    };
  }
}
