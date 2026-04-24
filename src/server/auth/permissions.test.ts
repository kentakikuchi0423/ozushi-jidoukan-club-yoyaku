import { describe, expect, it } from "vitest";
import {
  computeIsSuperAdminFromCount,
  hasFacilityPermission,
} from "./permissions";

describe("computeIsSuperAdminFromCount", () => {
  it("returns true when the admin owns all active facilities", () => {
    expect(computeIsSuperAdminFromCount(["ozu", "kita", "toku"], 3)).toBe(true);
  });

  it("is insensitive to ordering and duplicates", () => {
    expect(computeIsSuperAdminFromCount(["toku", "ozu", "kita"], 3)).toBe(true);
    expect(
      computeIsSuperAdminFromCount(["ozu", "ozu", "kita", "toku"], 3),
    ).toBe(true);
  });

  it("returns false when the admin owns fewer than the active count", () => {
    expect(computeIsSuperAdminFromCount([], 3)).toBe(false);
    expect(computeIsSuperAdminFromCount(["ozu"], 3)).toBe(false);
    expect(computeIsSuperAdminFromCount(["ozu", "kita"], 3)).toBe(false);
  });

  it("returns false when there are no active facilities", () => {
    expect(computeIsSuperAdminFromCount([], 0)).toBe(false);
    expect(computeIsSuperAdminFromCount(["ozu"], 0)).toBe(false);
  });

  it("scales to additional dynamic facilities", () => {
    expect(
      computeIsSuperAdminFromCount(["ozu", "kita", "toku", "shin1"], 4),
    ).toBe(true);
    expect(computeIsSuperAdminFromCount(["ozu", "kita", "toku"], 4)).toBe(
      false,
    );
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
