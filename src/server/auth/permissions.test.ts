import { describe, expect, it } from "vitest";
import { FACILITY_CODES } from "@/lib/facility";
import { computeIsSuperAdmin, hasFacilityPermission } from "./permissions";

describe("computeIsSuperAdmin", () => {
  it("returns true when the admin owns all three facilities", () => {
    expect(computeIsSuperAdmin(["ozu", "kita", "toku"])).toBe(true);
    expect(computeIsSuperAdmin([...FACILITY_CODES])).toBe(true);
  });

  it("is insensitive to ordering and duplicates", () => {
    expect(computeIsSuperAdmin(["toku", "ozu", "kita"])).toBe(true);
    expect(computeIsSuperAdmin(["ozu", "ozu", "kita", "toku"])).toBe(true);
  });

  it("returns false whenever any facility is missing", () => {
    expect(computeIsSuperAdmin([])).toBe(false);
    expect(computeIsSuperAdmin(["ozu"])).toBe(false);
    expect(computeIsSuperAdmin(["ozu", "kita"])).toBe(false);
    expect(computeIsSuperAdmin(["kita", "toku"])).toBe(false);
  });
});

describe("hasFacilityPermission", () => {
  it("returns true when the target facility is in the set", () => {
    expect(hasFacilityPermission(["ozu"], "ozu")).toBe(true);
    expect(hasFacilityPermission(["ozu", "kita"], "kita")).toBe(true);
    expect(hasFacilityPermission(["ozu", "kita", "toku"], "toku")).toBe(true);
  });

  it("returns false when the target is not in the set", () => {
    expect(hasFacilityPermission([], "ozu")).toBe(false);
    expect(hasFacilityPermission(["ozu"], "kita")).toBe(false);
    expect(hasFacilityPermission(["kita"], "toku")).toBe(false);
  });
});
