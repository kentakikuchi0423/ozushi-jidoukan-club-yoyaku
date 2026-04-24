import {
  deriveClubAvailability,
  type ClubAvailability,
  type ClubListing,
} from "@/lib/clubs/types";
import { isFacilityCodeFormat, type FacilityCode } from "@/lib/facility";

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

export function applyClubFilters<T extends ClubListing>(
  clubs: ReadonlyArray<T>,
  facility: FacilityCode | "",
  status: ClubAvailability | "",
): T[] {
  return clubs.filter((club) => {
    if (facility && club.facilityCode !== facility) return false;
    if (status && deriveClubAvailability(club) !== status) return false;
    return true;
  });
}
