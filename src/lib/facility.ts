export const FACILITY_CODES = ["ozu", "kita", "toku"] as const;
export type FacilityCode = (typeof FACILITY_CODES)[number];

export const FACILITY_NAMES: Record<FacilityCode, string> = {
  ozu: "大洲児童館",
  kita: "喜多児童館",
  toku: "徳森児童センター",
};

export function isFacilityCode(value: string): value is FacilityCode {
  return (FACILITY_CODES as readonly string[]).includes(value);
}

export function facilityName(code: FacilityCode): string {
  return FACILITY_NAMES[code];
}
