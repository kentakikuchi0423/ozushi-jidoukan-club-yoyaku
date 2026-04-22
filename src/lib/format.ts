// ADR-0010: 表示は常に Asia/Tokyo で行う。
// 日付・時刻のフォーマットを一本化して、UI の各所での timezone ずれを防ぐ。

import { fromZonedTime, toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Tokyo";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatJstDate(value: Date | string | number): string {
  return dateFormatter.format(toDate(value));
}

export function formatJstTime(value: Date | string | number): string {
  return timeFormatter.format(toDate(value));
}

/** 「2026年5月10日(日) 10:00〜12:00」形式のレンジ表示。 */
export function formatJstDateRange(
  start: Date | string | number,
  end: Date | string | number,
): string {
  const startDate = toDate(start);
  const endDate = toDate(end);
  return `${dateFormatter.format(startDate)} ${timeFormatter.format(startDate)}〜${timeFormatter.format(endDate)}`;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * `<input type="datetime-local">` が吐く `YYYY-MM-DDTHH:MM(:SS)?` を Asia/Tokyo
 * として解釈し、UTC の ISO 文字列に変換する。
 */
export function datetimeLocalJstToUtcIso(localValue: string): string {
  return fromZonedTime(localValue, TIMEZONE).toISOString();
}

/**
 * UTC ISO 文字列を Asia/Tokyo の datetime-local 形式 `YYYY-MM-DDTHH:MM` に変換する。
 * 編集フォームの初期値として `<input type="datetime-local">` に流し込む用途。
 */
export function utcIsoToDatetimeLocalJst(iso: string): string {
  const zoned = toZonedTime(new Date(iso), TIMEZONE);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(
    zoned.getDate(),
  )}T${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`;
}
