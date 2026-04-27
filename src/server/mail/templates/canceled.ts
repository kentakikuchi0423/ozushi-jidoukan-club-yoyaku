import "server-only";

import {
  type EmailContent,
  type FacilityContact,
  formatDateTimeRange,
  renderUserEmailHtml,
  renderUserEmailText,
  type RenderedEmail,
} from "./shared";

export interface CanceledEmailContext {
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
  const content: EmailContent = {
    title: "キャンセルを承りました",
    blocks: [
      {
        kind: "paragraph",
        text: "以下のご予約について、キャンセルを承りました。",
      },
      {
        kind: "details",
        rows: [
          { label: "クラブ名", value: ctx.clubName },
          {
            label: "開催日時",
            value: formatDateTimeRange(ctx.clubStartAt, ctx.clubEndAt),
          },
          { label: "予約番号", value: ctx.reservationNumber },
        ],
      },
      {
        kind: "paragraph",
        text: "またのご利用を心よりお待ちしております。",
      },
    ],
  };
  return {
    subject: `【大洲市児童館クラブ予約】キャンセルを承りました（${ctx.reservationNumber}）`,
    text: renderUserEmailText(content, facilities),
    html: renderUserEmailHtml(content, facilities),
  };
}
