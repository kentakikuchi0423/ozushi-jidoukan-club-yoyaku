import {
  deriveClubAvailability,
  type ClubAvailability,
  type ClubListing,
} from "@/lib/clubs/types";
import { isFacilityCodeFormat, type FacilityCode } from "@/lib/facility";
import { formatJstYmd } from "@/lib/format";

const STATUS_VALUES = ["available", "waitlist", "ended"] as const;

export function parseStatusFilter(
  value: string | undefined,
): ClubAvailability | "" {
  if (!value) return "";
  return (STATUS_VALUES as readonly string[]).includes(value)
    ? (value as ClubAvailability)
    : "";
}

export function parseFacilityFilter(
  value: string | undefined,
  allowed: readonly FacilityCode[],
): FacilityCode | "" {
  if (!value) return "";
  if (!isFacilityCodeFormat(value)) return "";
  return allowed.includes(value) ? value : "";
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 日付フィルタは `?dates=YYYY-MM-DD,YYYY-MM-DD,...` のカンマ区切りで受け取る。
 * 不正な要素は黙って捨て、重複は除去し、ソートして返す。
 */
export function parseDateFilter(value: string | undefined): string[] {
  if (!value) return [];
  const tokens = value.split(",").map((s) => s.trim());
  const valid = new Set<string>();
  for (const t of tokens) {
    if (!YMD_RE.test(t)) continue;
    // Date.parse で月日の妥当性も検証する（例: 2026-02-30 は弾く）
    const d = new Date(`${t}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) continue;
    if (formatJstYmdFromYmd(t) !== t) continue;
    valid.add(t);
  }
  return [...valid].sort();
}

/** "YYYY-MM-DD" → 同 "YYYY-MM-DD"（無効なら別文字列）。妥当性検証用。 */
function formatJstYmdFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() + 1 !== m ||
    date.getUTCDate() !== d
  ) {
    return "";
  }
  return ymd;
}

export function applyClubFilters<T extends ClubListing>(
  clubs: ReadonlyArray<T>,
  facility: FacilityCode | "",
  status: ClubAvailability | "",
  dates: ReadonlyArray<string> = [],
): T[] {
  const dateSet = dates.length > 0 ? new Set(dates) : null;
  return clubs.filter((club) => {
    if (facility && club.facilityCode !== facility) return false;
    if (status && deriveClubAvailability(club) !== status) return false;
    if (dateSet && !dateSet.has(formatJstYmd(club.startAt))) return false;
    return true;
  });
}
