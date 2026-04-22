import { describe, expect, it } from "vitest";
import { isReservationStatus, RESERVATION_STATUSES } from "./status";

describe("RESERVATION_STATUSES", () => {
  it("contains exactly confirmed, waitlisted, canceled in order", () => {
    expect(RESERVATION_STATUSES).toEqual([
      "confirmed",
      "waitlisted",
      "canceled",
    ]);
  });
});

describe("isReservationStatus", () => {
  it("accepts all three valid statuses", () => {
    for (const status of RESERVATION_STATUSES) {
      expect(isReservationStatus(status)).toBe(true);
    }
  });

  it("rejects strings outside the enum", () => {
    expect(isReservationStatus("")).toBe(false);
    expect(isReservationStatus("pending")).toBe(false);
    expect(isReservationStatus("CONFIRMED")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isReservationStatus(undefined)).toBe(false);
    expect(isReservationStatus(null)).toBe(false);
    expect(isReservationStatus(0)).toBe(false);
    expect(isReservationStatus({})).toBe(false);
  });
});
