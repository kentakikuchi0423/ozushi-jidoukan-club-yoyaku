"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  AuthenticationRequiredError,
  FacilityPermissionDeniedError,
  requireFacilityPermission,
} from "@/server/auth/guards";
import { logAdminAction } from "@/server/audit/log";
import {
  notifyReservationCanceled,
  notifyReservationPromoted,
} from "@/server/mail/notify";
import {
  adminCancelReservation,
  AdminReservationNotFoundError,
} from "@/server/reservations/admin-cancel";
import { fetchAdminReservationDetail } from "@/server/reservations/admin-detail";

export type AdminCancelActionResult =
  | { ok: true; clubId: string }
  | { ok: false; kind: "not_found"; message: string }
  | { ok: false; kind: "forbidden"; message: string }
  | { ok: false; kind: "unauthenticated"; message: string }
  | { ok: false; kind: "unknown"; message: string };

/**
 * 管理者画面の「キャンセルする」確認画面から呼ばれる Server Action。
 *
 * - 認証 + 対象館の権限チェック（Server Action でも再度実施。確認画面表示時の
 *   権限と submit 時の権限がズレていた場合の保険）
 * - admin_cancel_reservation RPC を実行
 * - キャンセル通知メール（利用者向け）と、必要に応じて繰り上げ通知メールを送信
 * - 監査ログ書き込み
 * - revalidatePath で予約者一覧の再取得を促す
 */
export async function adminCancelReservationAction(
  reservationId: string,
): Promise<AdminCancelActionResult> {
  // 取得は admin client（RLS バイパス）。クラブが削除済みなら null。
  const detail = await fetchAdminReservationDetail(reservationId);
  if (!detail) {
    return {
      ok: false,
      kind: "not_found",
      message: "予約が見つからないか、すでに削除されています。",
    };
  }

  // 認証 + 対象館の権限を強制
  let ctx;
  try {
    ctx = await requireFacilityPermission(detail.club.facilityCode);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        ok: false,
        kind: "unauthenticated",
        message: "ログインが必要です。",
      };
    }
    if (error instanceof FacilityPermissionDeniedError) {
      return {
        ok: false,
        kind: "forbidden",
        message: "この館の予約をキャンセルする権限がありません。",
      };
    }
    throw error;
  }

  let result;
  try {
    result = await adminCancelReservation(reservationId);
  } catch (error) {
    if (error instanceof AdminReservationNotFoundError) {
      return {
        ok: false,
        kind: "not_found",
        message: "予約が見つかりません。",
      };
    }
    console.error("[admin.reservation.cancel] RPC failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      kind: "unknown",
      message:
        "予約のキャンセルに失敗しました。\n時間をおいて再度お試しください。",
    };
  }

  // 新規にキャンセルした場合のみメールを送る（idempotent 二重呼び出しでの再送防止）
  if (result.canceled) {
    try {
      await notifyReservationCanceled({
        reservationNumber: detail.reservationNumber,
        email: detail.email,
        facilityName: detail.club.facilityName,
        clubName: detail.club.programName,
        clubStartAt: detail.club.startAt,
        clubEndAt: detail.club.endAt,
      });
    } catch (mailError) {
      console.error("[mail] notifyReservationCanceled failed", {
        tag: "reservation.canceled",
        scope: "admin",
        error:
          mailError instanceof Error ? mailError.message : String(mailError),
      });
    }
  }

  if (result.promotedReservationNumber) {
    try {
      await notifyReservationPromoted(result.promotedReservationNumber);
    } catch (mailError) {
      console.error("[mail] notifyReservationPromoted failed", {
        tag: "reservation.promoted",
        scope: "admin",
        error:
          mailError instanceof Error ? mailError.message : String(mailError),
      });
    }
  }

  // 監査ログ。個人情報（氏名/メール/電話）はメタに含めない。
  await logAdminAction({
    adminId: ctx.adminId,
    action: "reservation.admin_cancel",
    targetType: "reservation",
    targetId: detail.id,
    metadata: {
      reservationNumber: detail.reservationNumber,
      previousStatus: result.previousStatus,
      facilityCode: detail.club.facilityCode,
      clubId: detail.club.id,
      promoted: Boolean(result.promotedReservationNumber),
      idempotentNoop: !result.canceled,
    },
  });

  revalidatePath(`/admin/clubs/${detail.club.id}/reservations`);
  return { ok: true, clubId: detail.club.id };
}

/**
 * Form action 用ラッパ。成功時はクラブの予約一覧へ redirect する。
 */
export async function adminCancelReservationFormAction(
  reservationId: string,
  formData: FormData,
): Promise<void> {
  // CSRF 対策: hidden input でアクション識別を強制（誤投稿防止の念のため）
  const intent = formData.get("intent");
  if (intent !== "cancel") {
    throw new Error("invalid form intent");
  }

  const result = await adminCancelReservationAction(reservationId);
  if (!result.ok) {
    // 失敗時は redirect で error 情報を query に乗せる
    const params = new URLSearchParams({
      error: result.kind,
      message: result.message,
    });
    redirect(
      `/admin/reservations/${reservationId}/cancel?${params.toString()}`,
    );
  }
  redirect(`/admin/clubs/${result.clubId}/reservations?canceled=1`);
}
