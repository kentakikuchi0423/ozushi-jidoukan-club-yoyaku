import { describe, expect, it } from "vitest";
import {
  FACILITY_CODES,
  FACILITY_NAMES,
  facilityName,
  isFacilityCode,
} from "./facility";

describe("facility", () => {
  it("exposes exactly three facility codes", () => {
    expect(FACILITY_CODES).toHaveLength(3);
    expect([...FACILITY_CODES].sort()).toEqual(["kita", "ozu", "toku"]);
  });

  it("maps every code to a human-readable name", () => {
    for (const code of FACILITY_CODES) {
      expect(FACILITY_NAMES[code]).toBeTruthy();
      expect(facilityName(code)).toBe(FACILITY_NAMES[code]);
    }
  });

  it("narrows arbitrary strings with isFacilityCode", () => {
    expect(isFacilityCode("ozu")).toBe(true);
    expect(isFacilityCode("kita")).toBe(true);
    expect(isFacilityCode("toku")).toBe(true);
    expect(isFacilityCode("other")).toBe(false);
    expect(isFacilityCode("")).toBe(false);
  });
});
