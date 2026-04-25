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

export function renderPromotedEmail(
  ctx: ReservationEmailContext,
  facilities: ReadonlyArray<FacilityContact>,
): RenderedEmail {
  const url = buildConfirmUrl(ctx.reservationNumber, ctx.secureToken);
  const content: EmailContent = {
    title: "キャンセル待ちから繰り上がり、ご予約が確定しました",
    blocks: [
      {
        kind: "paragraph",
        text: "お待たせいたしました。お申込みいただいていた以下のクラブについて、キャンセルが発生したためキャンセル待ちから繰り上がり、ご予約が確定しました。",
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
        heading: "ご都合が合わない場合",
        paragraphs: [
          "他の方への影響を最小限にするため、お早めにキャンセルのお手続きをお願いします。",
        ],
      },
    ],
  };
  return {
    subject: `【大洲市児童館クラブ予約】キャンセル待ちから繰り上がりご予約が確定しました（${ctx.reservationNumber}）`,
    text: renderUserEmailText(content, facilities),
    html: renderUserEmailHtml(content, facilities),
  };
}
