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
    "ご返信いただいてもお答えできないことがありますので、",
    "お問い合わせは下記までご連絡ください。",
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
