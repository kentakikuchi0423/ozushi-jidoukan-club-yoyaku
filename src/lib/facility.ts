export const FACILITY_CODES = ["ozu", "kita", "toku"] as const;
export type FacilityCode = (typeof FACILITY_CODES)[number];

export const FACILITY_NAMES: Record<FacilityCode, string> = {
  ozu: "大洲児童館",
  kita: "喜多児童館",
  toku: "徳森児童センター",
};

// `public.facilities` テーブルの smallint 主キーと `FacilityCode` の対応。
// 初期 migration で各館の ID が 1..3 に固定されている（20260421000000_initial_schema.sql）。
// ここを参照することで、admin 画面からクラブを INSERT する際に `facilities` を
// 毎回 SELECT しなくて済む。
export const FACILITY_ID_BY_CODE: Record<FacilityCode, number> = {
  ozu: 1,
  kita: 2,
  toku: 3,
};

export const FACILITY_CODE_BY_ID: Record<number, FacilityCode> = {
  1: "ozu",
  2: "kita",
  3: "toku",
};

export function isFacilityCode(value: string): value is FacilityCode {
  return (FACILITY_CODES as readonly string[]).includes(value);
}

export function facilityName(code: FacilityCode): string {
  return FACILITY_NAMES[code];
}
