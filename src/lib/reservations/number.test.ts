import { describe, expect, it } from "vitest";
import {
  buildReservationNumber,
  isReservationNumber,
  parseReservationNumber,
  RESERVATION_NUMBER_REGEX,
  RESERVATION_NUMBER_SEQUENCE_MAX,
  RESERVATION_NUMBER_SEQUENCE_MIN,
} from "./number";

describe("reservation number", () => {
  describe("buildReservationNumber", () => {
    it("formats prefix + 6-digit sequence", () => {
      expect(buildReservationNumber("ozu", 123456)).toBe("ozu_123456");
      expect(
        buildReservationNumber("kita", RESERVATION_NUMBER_SEQUENCE_MIN),
      ).toBe("kita_100000");
      expect(
        buildReservationNumber("toku", RESERVATION_NUMBER_SEQUENCE_MAX),
      ).toBe("toku_999999");
    });

    it("rejects non-integer sequences", () => {
      expect(() => buildReservationNumber("ozu", 1.5)).toThrow(TypeError);
      expect(() => buildReservationNumber("ozu", Number.NaN)).toThrow(
        TypeError,
      );
    });

    it("rejects sequences outside [100000, 999999]", () => {
      expect(() =>
        buildReservationNumber("ozu", RESERVATION_NUMBER_SEQUENCE_MIN - 1),
      ).toThrow(RangeError);
      expect(() =>
        buildReservationNumber("ozu", RESERVATION_NUMBER_SEQUENCE_MAX + 1),
      ).toThrow(RangeError);
      expect(() => buildReservationNumber("ozu", 0)).toThrow(RangeError);
      expect(() => buildReservationNumber("ozu", -1)).toThrow(RangeError);
    });
  });

  describe("parseReservationNumber", () => {
    it("returns code and numeric sequence for valid input", () => {
      expect(parseReservationNumber("ozu_123456")).toEqual({
        code: "ozu",
        sequence: 123456,
      });
      expect(parseReservationNumber("kita_100000")).toEqual({
        code: "kita",
        sequence: 100000,
      });
      expect(parseReservationNumber("toku_999999")).toEqual({
        code: "toku",
        sequence: 999999,
      });
    });

    it("returns null for malformed input", () => {
      expect(parseReservationNumber("")).toBeNull();
      expect(parseReservationNumber("ozu_12345")).toBeNull();
      expect(parseReservationNumber("ozu_1234567")).toBeNull();
      expect(parseReservationNumber("ozu-123456")).toBeNull();
      expect(parseReservationNumber("OZU_123456")).toBeNull();
      expect(parseReservationNumber("abc_123456")).toBeNull();
      expect(parseReservationNumber(" ozu_123456")).toBeNull();
      expect(parseReservationNumber("ozu_123456 ")).toBeNull();
    });

    it("round-trips build → parse", () => {
      for (const code of ["ozu", "kita", "toku"] as const) {
        for (const seq of [100000, 123456, 999999]) {
          const parsed = parseReservationNumber(
            buildReservationNumber(code, seq),
          );
          expect(parsed).toEqual({ code, sequence: seq });
        }
      }
    });
  });

  describe("isReservationNumber", () => {
    it("accepts valid numbers", () => {
      expect(isReservationNumber("ozu_123456")).toBe(true);
      expect(isReservationNumber("kita_100000")).toBe(true);
      expect(isReservationNumber("toku_999999")).toBe(true);
    });

    it("rejects non-strings and malformed strings", () => {
      expect(isReservationNumber(undefined)).toBe(false);
      expect(isReservationNumber(null)).toBe(false);
      expect(isReservationNumber(123456)).toBe(false);
      expect(isReservationNumber({})).toBe(false);
      expect(isReservationNumber("ozu_abcdef")).toBe(false);
    });
  });

  describe("RESERVATION_NUMBER_REGEX", () => {
    it("is anchored so it does not match substrings", () => {
      expect(RESERVATION_NUMBER_REGEX.test("prefix ozu_123456 suffix")).toBe(
        false,
      );
    });
  });
});
