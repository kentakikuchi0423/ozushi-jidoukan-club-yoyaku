import "server-only";

import { fetchFacilities } from "@/server/facilities/list";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import { renderCanceledEmail } from "./templates/canceled";
import { renderConfirmedEmail } from "./templates/confirmed";
import { renderPromotedEmail } from "./templates/promoted";
import type { FacilityContact } from "./templates/shared";
import { renderWaitlistedEmail } from "./templates/waitlisted";
import { sendEmail } from "./send";

// 予約作成 / キャンセル / 繰り上げ の各シーンから呼ぶ高レベル通知 API。
// 例外は投げず、失敗は send.ts 内で console に記録する（予約 UX を
// メール送信失敗で崩さない方針）。呼び出し側は `void notify(...)` で
// fire-and-forget できる。
//
// メールの冒頭の「○○ 様」は、保護者の 1 人目の氏名を使う。複数人いる場合も
// 代表者として 1 人目に送るのが無難（DB 的にも position=0 = 最初に登録した人）。

async function fetchFooterFacilities(): Promise<FacilityContact[]> {
  try {
    const rows = await fetchFacilities({ includeDeleted: false });
    return rows.map((r) => ({ name: r.name, phone: r.phone }));
  } catch (error) {
    console.error("[mail] failed to load facilities for footer", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

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
  const facilities = await fetchFooterFacilities();
  if (ctx.status === "confirmed") {
    const msg = renderConfirmedEmail(
      {
        reservationNumber: ctx.reservationNumber,
        secureToken: ctx.secureToken,
        parentName: ctx.parentName,
        facilityName: ctx.facilityName,
        clubName: ctx.clubName,
        clubStartAt: ctx.clubStartAt,
        clubEndAt: ctx.clubEndAt,
      },
      facilities,
    );
    await sendEmail({
      tag: "reservation.confirmed",
      to: ctx.email,
      subject: msg.subject,
      text: msg.text,
    });
    return;
  }

  if (ctx.waitlistPosition === null) return; // 規約上ありえないが保険
  const msg = renderWaitlistedEmail(
    {
      reservationNumber: ctx.reservationNumber,
      secureToken: ctx.secureToken,
      parentName: ctx.parentName,
      facilityName: ctx.facilityName,
      clubName: ctx.clubName,
      clubStartAt: ctx.clubStartAt,
      clubEndAt: ctx.clubEndAt,
      waitlistPosition: ctx.waitlistPosition,
    },
    facilities,
  );
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
  const facilities = await fetchFooterFacilities();
  const msg = renderCanceledEmail(
    {
      reservationNumber: ctx.reservationNumber,
      parentName: ctx.parentName,
      facilityName: ctx.facilityName,
      clubName: ctx.clubName,
      clubStartAt: ctx.clubStartAt,
      clubEndAt: ctx.clubEndAt,
    },
    facilities,
  );
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
  email: string;
  club: {
    start_at: string;
    end_at: string;
    facility: {
      name: string;
    };
    program: {
      name: string;
    };
  };
  parents: Array<{ name: string }> | null;
}

/**
 * 繰り上げ対象の予約番号を受け取り、admin クライアント経由で送信に必要な情報を
 * 取得してメールを送る。secure_token は他人に返せないため server-side のみで扱う。
 * 保護者の 1 人目を「○○ 様」の宛先として使う。
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
       email,
       club:clubs!inner(
         start_at,
         end_at,
         facility:facilities!inner(name),
         program:club_programs!inner(name)
       ),
       parents:reservation_parents(name, position)`,
    )
    .eq("reservation_number", promotedReservationNumber)
    .order("position", {
      referencedTable: "reservation_parents",
      ascending: true,
    })
    .maybeSingle<PromotedLookupRow>();

  if (error || !data) {
    console.error("[mail] failed to load promoted reservation", {
      tag: "reservation.promoted",
      error: error?.message,
    });
    return;
  }

  const primaryParentName =
    data.parents && data.parents.length > 0 ? data.parents[0].name : "ご予約者";

  const facilities = await fetchFooterFacilities();
  const msg = renderPromotedEmail(
    {
      reservationNumber: data.reservation_number,
      secureToken: data.secure_token,
      parentName: primaryParentName,
      facilityName: data.club.facility.name,
      clubName: data.club.program.name,
      clubStartAt: data.club.start_at,
      clubEndAt: data.club.end_at,
    },
    facilities,
  );

  await sendEmail({
    tag: "reservation.promoted",
    to: data.email,
    subject: msg.subject,
    text: msg.text,
  });
}
