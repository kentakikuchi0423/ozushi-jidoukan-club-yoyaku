import { describe, expect, it } from "vitest";

import type { ClubListing } from "@/lib/clubs/types";
import {
  applyClubFilters,
  parseDateFilter,
  parseFacilityFilter,
  parseStatusFilter,
} from "./filter-utils";

const sample = (
  overrides: Partial<ClubListing> & Pick<ClubListing, "id" | "startAt">,
): ClubListing => ({
  facilityCode: "ozu",
  facilityName: "大洲児童館",
  programId: "p1",
  name: "サンプル",
  targetAge: "6〜12歳",
  summary: "",
  endAt: overrides.startAt,
  capacity: 10,
  photoUrl: null,
  description: null,
  publishedAt: "2026-04-01T00:00:00Z",
  confirmedCount: 0,
  waitlistedCount: 0,
  ...overrides,
});

describe("parseStatusFilter", () => {
  it("returns the value when valid", () => {
    expect(parseStatusFilter("available")).toBe("available");
    expect(parseStatusFilter("waitlist")).toBe("waitlist");
    expect(parseStatusFilter("ended")).toBe("ended");
  });

  it("returns empty for unknown / empty", () => {
    expect(parseStatusFilter(undefined)).toBe("");
    expect(parseStatusFilter("")).toBe("");
    expect(parseStatusFilter("hacked")).toBe("");
  });
});

describe("parseFacilityFilter", () => {
  it("accepts a value only when included in the allowed list", () => {
    expect(parseFacilityFilter("ozu", ["ozu", "kita", "toku"])).toBe("ozu");
    expect(parseFacilityFilter("kita", ["ozu"])).toBe("");
  });

  it("rejects malformed codes", () => {
    expect(parseFacilityFilter("OZU", ["ozu"])).toBe("");
    expect(parseFacilityFilter("'; drop", ["ozu"])).toBe("");
  });
});

describe("parseDateFilter", () => {
  it("returns an empty array for undefined / empty", () => {
    expect(parseDateFilter(undefined)).toEqual([]);
    expect(parseDateFilter("")).toEqual([]);
  });

  it("parses comma-separated YYYY-MM-DD values, sorts and dedupes", () => {
    expect(parseDateFilter("2026-05-10,2026-05-01,2026-05-10")).toEqual([
      "2026-05-01",
      "2026-05-10",
    ]);
  });

  it("rejects malformed tokens silently", () => {
    expect(parseDateFilter("not-a-date,2026-05-01,2026-13-01,2026-02-30")).toEqual([
      "2026-05-01",
    ]);
  });
});

describe("applyClubFilters with dates", () => {
  // JST: 2026-05-10 10:00 → UTC: 2026-05-10T01:00:00Z
  // JST: 2026-05-11 10:00 → UTC: 2026-05-11T01:00:00Z
  const clubs: ClubListing[] = [
    sample({ id: "a", startAt: "2026-05-10T01:00:00Z" }),
    sample({ id: "b", startAt: "2026-05-11T01:00:00Z" }),
    sample({ id: "c", startAt: "2026-06-01T01:00:00Z" }),
  ];

  it("returns all clubs when dates is empty", () => {
    const out = applyClubFilters(clubs, "", "", []);
    expect(out.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("filters by JST date match", () => {
    const out = applyClubFilters(clubs, "", "", ["2026-05-10", "2026-06-01"]);
    expect(out.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("interprets the date in JST (a UTC date close to midnight differs)", () => {
    // UTC 2026-05-10T15:30:00Z = JST 2026-05-11 00:30 → club is on the 11th (JST)
    const lateNight = sample({ id: "d", startAt: "2026-05-10T15:30:00Z" });
    const out = applyClubFilters([lateNight], "", "", ["2026-05-11"]);
    expect(out.map((c) => c.id)).toEqual(["d"]);
  });

  it("combines facility / status / dates with AND semantics", () => {
    const mixed: ClubListing[] = [
      sample({
        id: "a",
        startAt: "2026-05-10T01:00:00Z",
        facilityCode: "ozu",
      }),
      sample({
        id: "b",
        startAt: "2026-05-10T01:00:00Z",
        facilityCode: "kita",
      }),
    ];
    const out = applyClubFilters(mixed, "ozu", "", ["2026-05-10"]);
    expect(out.map((c) => c.id)).toEqual(["a"]);
  });
});
