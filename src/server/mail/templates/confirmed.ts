import "server-only";

import {
  buildConfirmUrl,
  type EmailContent,
  type FacilityContact,
  formatDateTimeRange,
  renderUserEmailHtml,
  renderUserEmailText,
  type ReservationEmailContext,
  type RenderedEmail,
} from "./shared";

export function renderConfirmedEmail(
  ctx: ReservationEmailContext,
  facilities: ReadonlyArray<FacilityContact>,
): RenderedEmail {
  const url = buildConfirmUrl(ctx.reservationNumber, ctx.secureToken);
  const content: EmailContent = {
    title: "ご予約を承りました",
    blocks: [
      {
        kind: "paragraph",
        text: `「${ctx.facilityName}」のクラブ予約をお申込みいただき、ありがとうございました。\n以下の内容でご予約を承りました。`,
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
        kind: "cta",
        heading: "予約内容の確認・キャンセル",
        intro:
          "下記のボタン（または URL）からお手続きいただけます。このメールは大切に保管してください。",
        url,
        ctaLabel: "予約内容を確認する",
      },
      {
        kind: "section",
        heading: "キャンセルについて",
        paragraphs: [
          "キャンセルは開催日の 2 営業日前 17 時までにお願いします。",
          "それ以降のキャンセルおよび無断欠席は、他の利用者への影響が大きいため原則ご遠慮ください。",
          "キャンセルが続く場合は、今後のご利用をお断りすることがあります。",
        ],
      },
    ],
  };
  return {
    subject: `【大洲市児童館クラブ予約】ご予約を承りました（${ctx.reservationNumber}）`,
    text: renderUserEmailText(content, facilities),
    html: renderUserEmailHtml(content, facilities),
  };
}
