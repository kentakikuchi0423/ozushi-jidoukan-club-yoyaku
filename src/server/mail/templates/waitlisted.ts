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

export interface WaitlistedEmailContext extends ReservationEmailContext {
  readonly waitlistPosition: number;
}

export function renderWaitlistedEmail(
  ctx: WaitlistedEmailContext,
  facilities: ReadonlyArray<FacilityContact>,
): RenderedEmail {
  const url = buildConfirmUrl(ctx.reservationNumber, ctx.secureToken);
  const content: EmailContent = {
    title: "キャンセル待ちリストに追加しました",
    blocks: [
      {
        kind: "paragraph",
        text: `「${ctx.facilityName}」のクラブ予約をお申込みいただき、ありがとうございました。\nお申込みいただいたクラブは定員に達していたため、キャンセル待ちとして承りました。`,
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
          {
            label: "キャンセル待ち順位",
            value: `${ctx.waitlistPosition} 番目`,
          },
        ],
      },
      {
        kind: "section",
        heading: "繰り上がりについて",
        paragraphs: [
          "キャンセルが発生した場合、キャンセル待ちリストの順番に従って自動的に繰り上がります。",
          "繰り上がって確定となった際には、改めてメールでお知らせいたします。",
        ],
      },
      {
        kind: "cta",
        heading: "お申込み内容の確認・取り消し",
        intro:
          "下記のボタン（または URL）からお手続きいただけます。このメールは大切に保管してください。",
        url,
        ctaLabel: "申込内容を確認する",
      },
    ],
  };
  return {
    subject: `【大洲市児童館クラブ予約】キャンセル待ちリストに追加しました（${ctx.reservationNumber}）`,
    text: renderUserEmailText(content, facilities),
    html: renderUserEmailHtml(content, facilities),
  };
}
