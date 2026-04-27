import "server-only";

import { formatJstDateRange } from "@/lib/format";
import { publicEnv } from "@/lib/env";

export interface ReservationEmailContext {
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

/* ----------------------------------------------------------------------
 * 構造化メール（利用者向け）
 *
 * 「テキスト版」と「HTML 版」をテンプレ毎にゼロから書くと差分が
 * 出やすいので、構造データを 1 度組み立てて両方を機械的にレンダリング
 * する形にしてある。テキストは罫線・改行で読みやすく、HTML は中央寄せ
 * のカード + 緑の CTA ボタンで視認性を確保する。
 *
 * 個別事情はあえて受け付けず、Block の組み合わせだけで表現すること。
 * 凝った装飾を入れたくなったら、まず Block の種類を増やすところから検討する。
 * ---------------------------------------------------------------------- */

export type EmailBlock =
  | { readonly kind: "paragraph"; readonly text: string }
  | {
      readonly kind: "details";
      readonly rows: ReadonlyArray<{
        readonly label: string;
        readonly value: string;
      }>;
    }
  | {
      readonly kind: "cta";
      readonly heading: string;
      readonly intro: string;
      readonly url: string;
      readonly ctaLabel: string;
    }
  | {
      readonly kind: "section";
      readonly heading: string;
      readonly paragraphs: ReadonlyArray<string>;
    };

export interface EmailContent {
  /** ヘッダ見出し（HTML はカード上部、テキストは先頭の見出し行）。 */
  readonly title: string;
  /** タイトル直下に並べる本体ブロック。 */
  readonly blocks: ReadonlyArray<EmailBlock>;
}

const AUTO_SEND_NOTICE = "このメールは予約システムから自動送信しています。";

/** テキスト版本文のレンダリング。ASCII 罫線で擬似的にカード化する。 */
export function renderUserEmailText(
  content: EmailContent,
  facilities: ReadonlyArray<FacilityContact>,
): string {
  const out: string[] = [];
  out.push(AUTO_SEND_NOTICE);
  out.push("");
  out.push(`■ ${content.title}`);
  out.push("");

  for (const block of content.blocks) {
    switch (block.kind) {
      case "paragraph":
        out.push(block.text);
        out.push("");
        break;
      case "details":
        out.push("────────────────────");
        for (const row of block.rows) {
          out.push(`${row.label}: ${row.value}`);
        }
        out.push("────────────────────");
        out.push("");
        break;
      case "cta":
        out.push(`■ ${block.heading}`);
        out.push(block.intro);
        out.push(block.url);
        out.push("");
        break;
      case "section":
        out.push(`■ ${block.heading}`);
        for (const p of block.paragraphs) out.push(p);
        out.push("");
        break;
    }
  }

  out.push(renderTextFooter(facilities));
  // 末尾に空行が積み上がるのを 1 行にまとめる
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+$/, "\n");
}

/** HTML 版本文のレンダリング。インラインスタイルで Outlook も含めて崩れにくく。 */
export function renderUserEmailHtml(
  content: EmailContent,
  facilities: ReadonlyArray<FacilityContact>,
): string {
  const parts: string[] = [];
  parts.push(
    `<div style="background:#fbfaf7;padding:24px 12px;font-family:'Hiragino Sans','Meiryo',sans-serif;color:#3b3a36;line-height:1.7;">`,
  );
  parts.push(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;"><tr><td>`,
  );

  // 自動送信注記（先頭・小さめ）
  parts.push(
    `<p style="font-size:12px;color:#7a7770;margin:0 0 16px 0;">${htmlEscape(AUTO_SEND_NOTICE)}</p>`,
  );

  // 本体カード
  parts.push(
    `<div style="background:#ffffff;border:1px solid #e6e1d7;border-radius:16px;padding:28px 24px;">`,
  );
  parts.push(
    `<h1 style="font-size:18px;font-weight:600;margin:0 0 20px 0;padding-bottom:12px;border-bottom:2px solid #4f7668;color:#3b3a36;">${htmlEscape(content.title)}</h1>`,
  );

  for (const block of content.blocks) {
    switch (block.kind) {
      case "paragraph":
        parts.push(
          `<p style="margin:0 0 16px 0;">${htmlEscape(block.text).replace(/\n/g, "<br />")}</p>`,
        );
        break;
      case "details":
        parts.push(
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbfaf7;border-radius:12px;margin:0 0 20px 0;">`,
        );
        for (const row of block.rows) {
          parts.push(
            `<tr><td style="padding:10px 16px;border-bottom:1px solid #f1ede4;color:#7a7770;font-size:13px;width:30%;white-space:nowrap;">${htmlEscape(row.label)}</td>` +
              `<td style="padding:10px 16px;border-bottom:1px solid #f1ede4;font-size:14px;font-weight:500;">${htmlEscape(row.value)}</td></tr>`,
          );
        }
        // 最後の行の border-bottom を消す
        parts[parts.length - 1] = parts[parts.length - 1].replace(
          /border-bottom:1px solid #f1ede4;/g,
          "",
        );
        parts.push(`</table>`);
        break;
      case "cta":
        parts.push(
          `<h2 style="font-size:14px;font-weight:600;margin:24px 0 8px 0;color:#4f7668;">${htmlEscape(block.heading)}</h2>`,
        );
        parts.push(
          `<p style="margin:0 0 12px 0;font-size:14px;">${htmlEscape(block.intro)}</p>`,
        );
        parts.push(
          `<p style="margin:0 0 8px 0;"><a href="${htmlEscape(block.url)}" style="display:inline-block;background:#4f7668;color:#ffffff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:500;font-size:14px;">${htmlEscape(block.ctaLabel)}</a></p>`,
        );
        parts.push(
          `<p style="margin:0 0 16px 0;font-size:12px;color:#7a7770;word-break:break-all;">${htmlEscape(block.url)}</p>`,
        );
        break;
      case "section":
        parts.push(
          `<h2 style="font-size:14px;font-weight:600;margin:20px 0 8px 0;color:#3b3a36;">${htmlEscape(block.heading)}</h2>`,
        );
        for (const p of block.paragraphs) {
          parts.push(
            `<p style="margin:0 0 10px 0;font-size:14px;">${htmlEscape(p)}</p>`,
          );
        }
        break;
    }
  }
  parts.push(`</div>`); // 本体カード end

  // フッタ
  parts.push(
    `<div style="margin-top:24px;padding:0 8px;font-size:12px;color:#7a7770;line-height:1.7;">`,
  );
  parts.push(
    `<p style="margin:0 0 6px 0;font-weight:500;color:#3b3a36;">大洲市児童館クラブ予約</p>`,
  );
  parts.push(
    `<p style="margin:0 0 6px 0;">お問い合わせは下記までご連絡ください。</p>`,
  );
  if (facilities.length === 0) {
    parts.push(
      `<p style="margin:0;">（各児童館・児童センターまでご連絡ください）</p>`,
    );
  } else {
    parts.push(`<ul style="margin:0;padding-left:18px;list-style:none;">`);
    for (const f of facilities) {
      parts.push(
        `<li style="margin:0 0 2px 0;">${htmlEscape(f.name)}: ${htmlEscape(f.phone)}</li>`,
      );
    }
    parts.push(`</ul>`);
  }
  parts.push(`</div>`); // フッタ end

  parts.push(`</td></tr></table>`);
  parts.push(`</div>`);

  return parts.join("");
}

/** 利用者向けメールのテキスト版フッタ。連絡先のみ。 */
function renderTextFooter(facilities: ReadonlyArray<FacilityContact>): string {
  const lines = [
    "――――――――――――――――――――",
    "大洲市児童館クラブ予約",
    "お問い合わせは下記までご連絡ください。",
  ];
  if (facilities.length === 0) {
    lines.push("（各児童館・児童センターまでご連絡ください）");
  } else {
    for (const f of facilities) {
      lines.push(`  ${f.name}: ${f.phone}`);
    }
  }
  return lines.join("\n");
}

/* ----------------------------------------------------------------------
 * 後方互換: 管理者招待メールはテキストのみで完結する別系統なので、
 * 旧来の `renderFooter` / `textToHtml` をそのまま残す（既存のテスト・
 * 招待メールテンプレが依存）。
 * ---------------------------------------------------------------------- */

/** 管理者招待メール用のテキストフッタ。利用者向けと違い、旧仕様を保つ。 */
export function renderFooter(
  facilities: ReadonlyArray<FacilityContact>,
): string {
  const lines = [
    "",
    "――――――――――――――――――――",
    "大洲市児童館クラブ予約",
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

/** HTML エスケープ。本文中のユーザー入力を扱うため必須。 */
export function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * プレーンテキスト本文を最低限の HTML に変換する。管理者招待など、
 * 構造化レンダラを通さないテンプレで使う簡易版。
 */
export function textToHtml(text: string): string {
  const escaped = htmlEscape(text);
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
