// ADR-0010: 表示は常に Asia/Tokyo で行う。
// 日付・時刻のフォーマットを一本化して、UI の各所での timezone ずれを防ぐ。

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
