import { describe, expect, it } from "vitest";
import {
  deriveClubAvailability,
  hasValidPhotoUrl,
  type ClubListing,
} from "./types";

const nowFixed = new Date("2026-05-01T10:00:00+09:00");

function listing(
  overrides: Partial<ClubListing> = {},
): Pick<ClubListing, "startAt" | "capacity" | "confirmedCount"> {
  return {
    startAt: "2026-05-10T10:00:00+09:00",
    capacity: 10,
    confirmedCount: 0,
    ...overrides,
  };
}

describe("deriveClubAvailability", () => {
  it("returns 'ended' when the club has already started", () => {
    expect(
      deriveClubAvailability(
        listing({ startAt: "2026-04-01T10:00:00+09:00" }),
        nowFixed,
      ),
    ).toBe("ended");
  });

  it("returns 'waitlist' when confirmed count meets or exceeds capacity", () => {
    expect(
      deriveClubAvailability(
        listing({ capacity: 10, confirmedCount: 10 }),
        nowFixed,
      ),
    ).toBe("waitlist");
    expect(
      deriveClubAvailability(
        listing({ capacity: 10, confirmedCount: 11 }),
        nowFixed,
      ),
    ).toBe("waitlist");
  });

  it("returns 'available' when there is remaining capacity", () => {
    expect(
      deriveClubAvailability(
        listing({ capacity: 10, confirmedCount: 0 }),
        nowFixed,
      ),
    ).toBe("available");
    expect(
      deriveClubAvailability(
        listing({ capacity: 10, confirmedCount: 9 }),
        nowFixed,
      ),
    ).toBe("available");
  });
});

describe("hasValidPhotoUrl", () => {
  it("accepts http and https URLs", () => {
    expect(hasValidPhotoUrl("https://example.com/photo.jpg")).toBe(true);
    expect(hasValidPhotoUrl("http://example.com/photo.jpg")).toBe(true);
  });

  it("rejects null and empty strings", () => {
    expect(hasValidPhotoUrl(null)).toBe(false);
    expect(hasValidPhotoUrl("")).toBe(false);
  });

  it("rejects non-http(s) schemes", () => {
    expect(hasValidPhotoUrl("javascript:alert(1)")).toBe(false);
    expect(hasValidPhotoUrl("ftp://example.com/file")).toBe(false);
    expect(hasValidPhotoUrl("data:image/png;base64,AAAA")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(hasValidPhotoUrl("not a url")).toBe(false);
    expect(hasValidPhotoUrl("example.com")).toBe(false);
  });
});
