import { describe, expect, it } from "vitest";
import {
  generateSecureToken,
  isSecureTokenFormat,
  SECURE_TOKEN_MIN_LENGTH,
} from "./secure-token";

describe("secure token", () => {
  describe("generateSecureToken", () => {
    it("returns a base64url string longer than the DB minimum", () => {
      const token = generateSecureToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(SECURE_TOKEN_MIN_LENGTH);
    });

    it("produces distinct tokens across many invocations", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 1000; i += 1) {
        tokens.add(generateSecureToken());
      }
      expect(tokens.size).toBe(1000);
    });

    it("is passed by isSecureTokenFormat", () => {
      for (let i = 0; i < 50; i += 1) {
        expect(isSecureTokenFormat(generateSecureToken())).toBe(true);
      }
    });
  });

  describe("isSecureTokenFormat", () => {
    it("rejects non-strings", () => {
      expect(isSecureTokenFormat(undefined)).toBe(false);
      expect(isSecureTokenFormat(null)).toBe(false);
      expect(isSecureTokenFormat(123)).toBe(false);
      expect(isSecureTokenFormat({})).toBe(false);
    });

    it("rejects strings shorter than the minimum", () => {
      expect(isSecureTokenFormat("a".repeat(SECURE_TOKEN_MIN_LENGTH - 1))).toBe(
        false,
      );
    });

    it("rejects strings with non-base64url characters", () => {
      expect(
        isSecureTokenFormat("a".repeat(SECURE_TOKEN_MIN_LENGTH - 1) + "/"),
      ).toBe(false);
      expect(
        isSecureTokenFormat("a".repeat(SECURE_TOKEN_MIN_LENGTH - 1) + "+"),
      ).toBe(false);
      expect(
        isSecureTokenFormat("a".repeat(SECURE_TOKEN_MIN_LENGTH - 1) + "="),
      ).toBe(false);
      expect(
        isSecureTokenFormat("a".repeat(SECURE_TOKEN_MIN_LENGTH - 1) + " "),
      ).toBe(false);
    });

    it("accepts minimum-length valid tokens", () => {
      expect(isSecureTokenFormat("a".repeat(SECURE_TOKEN_MIN_LENGTH))).toBe(
        true,
      );
    });
  });
});
