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

export const FOOTER = `
――――――――――――――――――――
大洲市児童館クラブ予約
このメールは予約システムから自動送信しています。
ご返信いただいてもお答えできないことがありますので、
お問い合わせは各児童館/児童センターまでご連絡ください。`;
