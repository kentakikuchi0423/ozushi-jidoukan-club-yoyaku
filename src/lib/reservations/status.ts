// 予約ステータスの共有型。DB の `public.reservation_status` ENUM と一致させる。
// UI / server wrapper / zod 等どこからでも安全に参照できるよう、ここを単一の
// 真実のソースとする。

export const RESERVATION_STATUSES = [
  "confirmed",
  "waitlisted",
  "canceled",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export function isReservationStatus(
  value: unknown,
): value is ReservationStatus {
  return (
    typeof value === "string" &&
    (RESERVATION_STATUSES as readonly string[]).includes(value)
  );
}
