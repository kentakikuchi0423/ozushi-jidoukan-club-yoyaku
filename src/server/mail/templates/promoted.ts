import {
  buildConfirmUrl,
  formatDateTimeRange,
  FOOTER,
  type ReservationEmailContext,
  type RenderedEmail,
} from "./shared";

export function renderPromotedEmail(
  ctx: ReservationEmailContext,
): RenderedEmail {
  const url = buildConfirmUrl(ctx.reservationNumber, ctx.secureToken);
  return {
    subject: `【大洲市児童館クラブ予約】キャンセル待ちから繰り上がりご予約が確定しました（${ctx.reservationNumber}）`,
    text: `${ctx.parentName} 様

お待たせいたしました。お申込みいただいていた以下のクラブについて、
キャンセルが発生したためキャンセル待ちから繰り上がり、ご予約が確定しました。

────────────────────
クラブ名: ${ctx.clubName}
開催日時: ${formatDateTimeRange(ctx.clubStartAt, ctx.clubEndAt)}
予約番号: ${ctx.reservationNumber}
────────────────────

■ 予約内容の確認・キャンセル
以下の URL からお手続きいただけます。このメールは大切に保管してください。
${url}

ご都合が合わなくなった場合は、他の方への影響を最小限にするため
お早めにキャンセルのお手続きをお願いします。
${FOOTER}`,
  };
}
