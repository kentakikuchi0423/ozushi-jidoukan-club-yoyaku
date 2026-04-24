import { describe, expect, it } from "vitest";
import { FACILITY_CODE_REGEX, isFacilityCodeFormat } from "./facility";

describe("facility", () => {
  it("FACILITY_CODE_REGEX accepts valid prefix formats", () => {
    expect(FACILITY_CODE_REGEX.test("ozu")).toBe(true);
    expect(FACILITY_CODE_REGEX.test("kita")).toBe(true);
    expect(FACILITY_CODE_REGEX.test("toku")).toBe(true);
    expect(FACILITY_CODE_REGEX.test("ab")).toBe(true); // 最小 2 文字
    expect(FACILITY_CODE_REGEX.test("abcdefghij")).toBe(true); // 最大 10 文字
    expect(FACILITY_CODE_REGEX.test("shin1")).toBe(true);
  });

  it("FACILITY_CODE_REGEX rejects invalid formats", () => {
    expect(FACILITY_CODE_REGEX.test("")).toBe(false);
    expect(FACILITY_CODE_REGEX.test("a")).toBe(false); // 1 文字だけ
    expect(FACILITY_CODE_REGEX.test("abcdefghijk")).toBe(false); // 11 文字
    expect(FACILITY_CODE_REGEX.test("1abc")).toBe(false); // 数字始まり
    expect(FACILITY_CODE_REGEX.test("Ozu")).toBe(false); // 大文字
    expect(FACILITY_CODE_REGEX.test("ab_c")).toBe(false); // アンダースコア
    expect(FACILITY_CODE_REGEX.test("ab-c")).toBe(false); // ハイフン
  });

  it("isFacilityCodeFormat matches FACILITY_CODE_REGEX", () => {
    expect(isFacilityCodeFormat("ozu")).toBe(true);
    expect(isFacilityCodeFormat("kita")).toBe(true);
    expect(isFacilityCodeFormat("toku")).toBe(true);
    expect(isFacilityCodeFormat("invalid_code")).toBe(false);
    expect(isFacilityCodeFormat("")).toBe(false);
  });
});
