import { isHoliday } from "@holiday-jp/holiday_jp";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

// キャンセル期限: 「クラブ開催日の 2 営業日前 17:00 JST」まで。
// 「営業日」= 日本の土日祝を除く平日（ADR-0010 / open-questions.md Q3）。
//
// 例:
//   * クラブ開催日が 2026-05-22 (金) の場合、2 営業日前は 2026-05-20 (水)。
//     → 締切は 2026-05-20 17:00 JST
//   * クラブ開催日が 2026-05-18 (月) の場合、2 営業日前は土日を飛ばした
//     2026-05-14 (木)。→ 締切は 2026-05-14 17:00 JST
//
// 営業日判定は `@holiday-jp/holiday_jp` による祝日判定 + 土日の除外を使う。

const TIMEZONE = "Asia/Tokyo";
const BUSINESS_DAYS_BEFORE = 2;
const DEADLINE_HOUR_JST = 17;

/**
 * JST の曜日を 0=日..6=土 で返す（ローカル日付は Asia/Tokyo 基準）。
 */
function jstDayOfWeek(date: Date): number {
  return toZonedTime(date, TIMEZONE).getDay();
}

function isBusinessDay(date: Date): boolean {
  const weekday = jstDayOfWeek(date);
  if (weekday === 0 || weekday === 6) return false;
  return !isHoliday(toZonedTime(date, TIMEZONE));
}

function subtractOneDayJst(date: Date): Date {
  const zoned = toZonedTime(date, TIMEZONE);
  zoned.setDate(zoned.getDate() - 1);
  return fromZonedTime(zoned, TIMEZONE);
}

/**
 * 指定した `clubStartAt`（UTC timestamptz 由来）から、N 営業日前の 00:00 JST
 * に相当する UTC Date を返す。
 */
function subtractBusinessDays(clubStartAt: Date, days: number): Date {
  // 開催日の「日付」を JST で取得
  const zonedStart = toZonedTime(clubStartAt, TIMEZONE);
  zonedStart.setHours(0, 0, 0, 0);
  let cursor = fromZonedTime(zonedStart, TIMEZONE);

  let remaining = days;
  while (remaining > 0) {
    cursor = subtractOneDayJst(cursor);
    if (isBusinessDay(cursor)) remaining -= 1;
  }
  return cursor;
}

/**
 * キャンセル可能期限を計算する。
 * 返り値は UTC の Date（`Asia/Tokyo` で 2 営業日前 17:00 に相当）。
 */
export function computeCancellationDeadline(
  clubStartAt: Date | string | number,
): Date {
  const startAt = toDate(clubStartAt);
  const dayAtZero = subtractBusinessDays(startAt, BUSINESS_DAYS_BEFORE);
  // その日の 17:00 JST を UTC に変換する
  const zoned = toZonedTime(dayAtZero, TIMEZONE);
  zoned.setHours(DEADLINE_HOUR_JST, 0, 0, 0);
  return fromZonedTime(zoned, TIMEZONE);
}

/**
 * 現時点で `clubStartAt` のクラブをキャンセル可能か判定する。
 * 現在時刻が締切と同時刻なら「可」（`<=` で判定）。
 * ただし、開催日時を過ぎていたら締切前でも不可（防御的に明示的にチェック）。
 */
export function isCancellable(
  clubStartAt: Date | string | number,
  now: Date | string | number = new Date(),
): boolean {
  const nowDate = toDate(now);
  const startDate = toDate(clubStartAt);
  if (nowDate.getTime() >= startDate.getTime()) return false;
  const deadline = computeCancellationDeadline(clubStartAt);
  return nowDate.getTime() <= deadline.getTime();
}

/**
 * キャンセル不可の理由を返す。`null` ならキャンセル可能。
 *   - `"event-started"`: 開催日時を過ぎている
 *   - `"past-deadline"`: 開催前だがキャンセル期限を過ぎている
 * UI で理由ごとに異なるメッセージを出すために使う。
 */
export type CancellationBlockedReason = "event-started" | "past-deadline";

export function cancellationBlockedReason(
  clubStartAt: Date | string | number,
  now: Date | string | number = new Date(),
): CancellationBlockedReason | null {
  const nowDate = toDate(now);
  const startDate = toDate(clubStartAt);
  if (nowDate.getTime() >= startDate.getTime()) return "event-started";
  const deadline = computeCancellationDeadline(clubStartAt);
  if (nowDate.getTime() > deadline.getTime()) return "past-deadline";
  return null;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}
