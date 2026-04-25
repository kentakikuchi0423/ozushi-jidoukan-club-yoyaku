import {
  type FacilityContact,
  formatDateTimeRange,
  renderFooter,
  type RenderedEmail,
  textToHtml,
} from "./shared";

export interface CanceledEmailContext {
  readonly parentName: string;
  readonly facilityName: string;
  readonly clubName: string;
  readonly clubStartAt: string;
  readonly clubEndAt: string;
  readonly reservationNumber: string;
}

export function renderCanceledEmail(
  ctx: CanceledEmailContext,
  facilities: ReadonlyArray<FacilityContact>,
): RenderedEmail {
  const text = `${ctx.parentName} 様

以下のご予約について、キャンセルを承りました。

────────────────────
クラブ名: ${ctx.clubName}
開催日時: ${formatDateTimeRange(ctx.clubStartAt, ctx.clubEndAt)}
予約番号: ${ctx.reservationNumber}
────────────────────

またのご利用を心よりお待ちしております。
${renderFooter(facilities)}`;
  return {
    subject: `【大洲市児童館クラブ予約】キャンセルを承りました（${ctx.reservationNumber}）`,
    text,
    html: textToHtml(text),
  };
}
