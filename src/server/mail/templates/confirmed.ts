import {
  buildConfirmUrl,
  type FacilityContact,
  formatDateTimeRange,
  renderFooter,
  type ReservationEmailContext,
  type RenderedEmail,
  textToHtml,
} from "./shared";

export function renderConfirmedEmail(
  ctx: ReservationEmailContext,
  facilities: ReadonlyArray<FacilityContact>,
): RenderedEmail {
  const url = buildConfirmUrl(ctx.reservationNumber, ctx.secureToken);
  const text = `${ctx.parentName} 様

この度は「${ctx.facilityName}」のクラブ予約にお申込みいただき、ありがとうございました。
以下の内容でご予約を承りました。

────────────────────
クラブ名: ${ctx.clubName}
開催日時: ${formatDateTimeRange(ctx.clubStartAt, ctx.clubEndAt)}
予約番号: ${ctx.reservationNumber}
────────────────────

■ 予約内容の確認・キャンセル
以下の URL からお手続きいただけます。このメールは大切に保管してください。
${url}

■ キャンセルについて
キャンセルは開催日の 2 営業日前 17 時までにお願いします。
それ以降のキャンセルおよび無断欠席は、他の利用者への影響が大きいため原則ご遠慮ください。
キャンセルが続く場合は、今後のご利用をお断りすることがあります。
${renderFooter(facilities)}`;
  return {
    subject: `【大洲市児童館クラブ予約】ご予約を承りました（${ctx.reservationNumber}）`,
    text,
    html: textToHtml(text),
  };
}
