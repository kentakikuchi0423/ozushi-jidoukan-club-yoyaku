import {
  buildConfirmUrl,
  formatDateTimeRange,
  FOOTER,
  type ReservationEmailContext,
  type RenderedEmail,
} from "./shared";

export interface WaitlistedEmailContext extends ReservationEmailContext {
  readonly waitlistPosition: number;
}

export function renderWaitlistedEmail(
  ctx: WaitlistedEmailContext,
): RenderedEmail {
  const url = buildConfirmUrl(ctx.reservationNumber, ctx.secureToken);
  return {
    subject: `【大洲市児童館クラブ予約】キャンセル待ちリストに追加しました（${ctx.reservationNumber}）`,
    text: `${ctx.parentName} 様

この度は「${ctx.facilityName}」のクラブ予約にお申込みいただき、ありがとうございました。
お申込みいただいたクラブは定員に達していたため、キャンセル待ちとして承りました。

────────────────────
クラブ名: ${ctx.clubName}
開催日時: ${formatDateTimeRange(ctx.clubStartAt, ctx.clubEndAt)}
予約番号: ${ctx.reservationNumber}
キャンセル待ち順位: ${ctx.waitlistPosition} 番目
────────────────────

キャンセルが発生した場合、キャンセル待ちリストの順番に従って自動的に繰り上がります。
繰り上がって確定となった際には、改めてメールでお知らせいたします。

■ お申込み内容の確認・取り消し
以下の URL からお手続きいただけます。このメールは大切に保管してください。
${url}
${FOOTER}`,
  };
}
