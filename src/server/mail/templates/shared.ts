import { formatJstDateRange } from "@/lib/format";
import { publicEnv } from "@/lib/env";

export interface ReservationEmailContext {
  readonly parentName: string;
  readonly facilityName: string;
  readonly clubName: string;
  readonly clubStartAt: string;
  readonly clubEndAt: string;
  readonly reservationNumber: string;
  readonly secureToken: string;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  /**
   * 任意の HTML 版本文。Resend に渡すと multipart として送信され、
   * 受信側はクライアントに応じて html/text を選んで表示する。未指定なら
   * `text` だけ送る。
   */
  readonly html?: string;
}

export function buildConfirmUrl(
  reservationNumber: string,
  secureToken: string,
): string {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    r: reservationNumber,
    t: secureToken,
  });
  return `${base}/reservations?${params.toString()}`;
}

export function formatDateTimeRange(startAt: string, endAt: string): string {
  return formatJstDateRange(startAt, endAt);
}

export interface FacilityContact {
  readonly name: string;
  readonly phone: string;
}

/**
 * 利用者向けメールのフッター。
 * 非削除の全館の連絡先を列挙する（ADR-0011 の決定事項）。
 */
export function renderFooter(
  facilities: ReadonlyArray<FacilityContact>,
): string {
  const lines = [
    "",
    "――――――――――――――――――――",
    "大洲市児童館クラブ予約",
    "このメールは予約システムから自動送信しています。",
    "ご返信いただいてもお答えできないことがありますので、お問い合わせは下記までご連絡ください。",
  ];
  if (facilities.length === 0) {
    lines.push("（各児童館/児童センターまでご連絡ください）");
  } else {
    for (const f of facilities) {
      lines.push(`  ${f.name}: ${f.phone}`);
    }
  }
  return lines.join("\n");
}

/** HTML エスケープ。本文中のユーザー入力（保護者氏名等）を扱うため必須。 */
export function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * プレーンテキスト本文を最低限の HTML に変換する。
 * - 全文を htmlEscape
 * - http(s):// で始まる URL を `<a>` タグでリンク化（クリック可能に）
 * - 改行を `<br />` に変換
 * メール用なので CSS は最小限・インラインのみ。`<pre>` で等幅にすると
 * 罫線・段落が崩れずに表示される。
 */
export function textToHtml(text: string): string {
  const escaped = htmlEscape(text);
  // URL をリンク化（http/https のみ。末尾の句読点は除外）
  const linked = escaped.replace(
    /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)]/g,
    (url) => `<a href="${url}">${url}</a>`,
  );
  return [
    "<div style=\"font-family:'Hiragino Sans','Meiryo',sans-serif;line-height:1.7;color:#3b3a36;white-space:pre-wrap;word-break:break-word;\">",
    linked,
    "</div>",
  ].join("");
}
