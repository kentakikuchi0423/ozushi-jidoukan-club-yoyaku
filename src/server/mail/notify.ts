import "server-only";

import { getSupabaseAdminClient } from "@/server/supabase/admin";
import { renderCanceledEmail } from "./templates/canceled";
import { renderConfirmedEmail } from "./templates/confirmed";
import { renderPromotedEmail } from "./templates/promoted";
import { renderWaitlistedEmail } from "./templates/waitlisted";
import { sendEmail } from "./send";

// 予約作成 / キャンセル / 繰り上げ の各シーンから呼ぶ高レベル通知 API。
// 例外は投げず、失敗は send.ts 内で console に記録する（予約 UX を
// メール送信失敗で崩さない方針）。呼び出し側は `void notify(...)` で
// fire-and-forget できる。

export interface CreatedContext {
  readonly reservationNumber: string;
  readonly secureToken: string;
  readonly status: "confirmed" | "waitlisted";
  readonly waitlistPosition: number | null;
  readonly parentName: string;
  readonly email: string;
  readonly facilityName: string;
  readonly clubName: string;
  readonly clubStartAt: string;
  readonly clubEndAt: string;
}

export async function notifyReservationCreated(
  ctx: CreatedContext,
): Promise<void> {
  if (ctx.status === "confirmed") {
    const msg = renderConfirmedEmail({
      reservationNumber: ctx.reservationNumber,
      secureToken: ctx.secureToken,
      parentName: ctx.parentName,
      facilityName: ctx.facilityName,
      clubName: ctx.clubName,
      clubStartAt: ctx.clubStartAt,
      clubEndAt: ctx.clubEndAt,
    });
    await sendEmail({
      tag: "reservation.confirmed",
      to: ctx.email,
      subject: msg.subject,
      text: msg.text,
    });
    return;
  }

  // waitlisted
  if (ctx.waitlistPosition === null) return; // 規約上ありえないが保険
  const msg = renderWaitlistedEmail({
    reservationNumber: ctx.reservationNumber,
    secureToken: ctx.secureToken,
    parentName: ctx.parentName,
    facilityName: ctx.facilityName,
    clubName: ctx.clubName,
    clubStartAt: ctx.clubStartAt,
    clubEndAt: ctx.clubEndAt,
    waitlistPosition: ctx.waitlistPosition,
  });
  await sendEmail({
    tag: "reservation.waitlisted",
    to: ctx.email,
    subject: msg.subject,
    text: msg.text,
  });
}

export interface CanceledContext {
  readonly reservationNumber: string;
  readonly parentName: string;
  readonly email: string;
  readonly facilityName: string;
  readonly clubName: string;
  readonly clubStartAt: string;
  readonly clubEndAt: string;
}

export async function notifyReservationCanceled(
  ctx: CanceledContext,
): Promise<void> {
  const msg = renderCanceledEmail({
    reservationNumber: ctx.reservationNumber,
    parentName: ctx.parentName,
    facilityName: ctx.facilityName,
    clubName: ctx.clubName,
    clubStartAt: ctx.clubStartAt,
    clubEndAt: ctx.clubEndAt,
  });
  await sendEmail({
    tag: "reservation.canceled",
    to: ctx.email,
    subject: msg.subject,
    text: msg.text,
  });
}

interface PromotedLookupRow {
  reservation_number: string;
  secure_token: string;
  parent_name: string;
  email: string;
  club: {
    name: string;
    start_at: string;
    end_at: string;
    facility: {
      name: string;
    };
  };
}

/**
 * 繰り上げ対象の予約番号を受け取り、admin クライアント経由で送信に必要な情報を
 * 取得してメールを送る。secure_token は他人に返せないため server-side のみで扱う。
 */
export async function notifyReservationPromoted(
  promotedReservationNumber: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("reservations")
    .select(
      `reservation_number,
       secure_token,
       parent_name,
       email,
       club:clubs!inner(
         name,
         start_at,
         end_at,
         facility:facilities!inner(name)
       )`,
    )
    .eq("reservation_number", promotedReservationNumber)
    .maybeSingle<PromotedLookupRow>();

  if (error || !data) {
    console.error("[mail] failed to load promoted reservation", {
      tag: "reservation.promoted",
      error: error?.message,
    });
    return;
  }

  const msg = renderPromotedEmail({
    reservationNumber: data.reservation_number,
    secureToken: data.secure_token,
    parentName: data.parent_name,
    facilityName: data.club.facility.name,
    clubName: data.club.name,
    clubStartAt: data.club.start_at,
    clubEndAt: data.club.end_at,
  });

  await sendEmail({
    tag: "reservation.promoted",
    to: data.email,
    subject: msg.subject,
    text: msg.text,
  });
}
