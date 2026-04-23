import { describe, expect, it } from "vitest";

import { isPasswordStrong } from "./password";

describe("isPasswordStrong", () => {
  it("accepts 8+ chars with letters and digits", () => {
    expect(isPasswordStrong("abc12345")).toBe(true);
    expect(isPasswordStrong("Password1")).toBe(true);
    expect(isPasswordStrong("Abcdefgh1234")).toBe(true);
  });

  it("rejects shorter than 8", () => {
    expect(isPasswordStrong("abc1234")).toBe(false);
  });

  it("rejects letters only", () => {
    expect(isPasswordStrong("abcdefghij")).toBe(false);
    expect(isPasswordStrong("ABCDEFGHIJ")).toBe(false);
  });

  it("rejects digits only", () => {
    expect(isPasswordStrong("12345678")).toBe(false);
  });

  it("rejects non-string input", () => {
    // @ts-expect-error -- runtime guard
    expect(isPasswordStrong(undefined)).toBe(false);
    // @ts-expect-error -- runtime guard
    expect(isPasswordStrong(null)).toBe(false);
    // @ts-expect-error -- runtime guard
    expect(isPasswordStrong(12345678)).toBe(false);
  });

  it("allows symbols as long as letter + digit are present", () => {
    expect(isPasswordStrong("abc!@#12")).toBe(true);
  });
});
