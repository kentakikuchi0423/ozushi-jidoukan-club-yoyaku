import { describe, expect, it } from "vitest";
import {
  datetimeLocalJstToUtcIso,
  formatJstDate,
  formatJstDateRange,
  formatJstTime,
  utcIsoToDatetimeLocalJst,
} from "./format";

// 入力が UTC の ISO 文字列でも、Date オブジェクトでも、JST に寄せて整形されることを確認する。
// 10:00 JST = 01:00 UTC をベースにする。

describe("formatJstDate", () => {
  it("formats UTC ISO strings as a Japanese date with weekday", () => {
    const out = formatJstDate("2026-05-22T01:00:00Z");
    expect(out).toContain("2026年");
    expect(out).toContain("5月22日");
    // 曜日は "金"（金曜日）
    expect(out).toContain("金");
  });

  it("handles a Date instance", () => {
    const out = formatJstDate(new Date("2026-05-22T01:00:00Z"));
    expect(out).toContain("5月22日");
  });
});

describe("formatJstTime", () => {
  it("returns HH:mm in 24-hour JST", () => {
    expect(formatJstTime("2026-05-22T01:00:00Z")).toBe("10:00");
    expect(formatJstTime("2026-05-22T03:30:00Z")).toBe("12:30");
  });

  it("handles late-night UTC that rolls over to next day in JST", () => {
    // 2026-05-22T16:00Z = 2026-05-23T01:00 JST
    expect(formatJstTime("2026-05-22T16:00:00Z")).toBe("01:00");
  });
});

describe("formatJstDateRange", () => {
  it("combines date + start/end time with the 〜 separator", () => {
    const out = formatJstDateRange(
      "2026-05-22T01:00:00Z",
      "2026-05-22T03:00:00Z",
    );
    expect(out).toContain("2026年");
    expect(out).toContain("5月22日");
    expect(out).toContain("10:00〜12:00");
  });
});

describe("datetimeLocalJstToUtcIso", () => {
  it("treats the input as Asia/Tokyo wall-clock time", () => {
    // 2026-05-22 10:00 JST = 2026-05-22 01:00 UTC
    expect(datetimeLocalJstToUtcIso("2026-05-22T10:00")).toBe(
      "2026-05-22T01:00:00.000Z",
    );
  });

  it("accepts HH:MM:SS form as well", () => {
    expect(datetimeLocalJstToUtcIso("2026-05-22T10:00:00")).toBe(
      "2026-05-22T01:00:00.000Z",
    );
  });

  it("handles times that roll over to the previous UTC day", () => {
    // 2026-05-22 08:00 JST = 2026-05-21 23:00 UTC
    expect(datetimeLocalJstToUtcIso("2026-05-22T08:00")).toBe(
      "2026-05-21T23:00:00.000Z",
    );
  });
});

describe("utcIsoToDatetimeLocalJst", () => {
  it("round-trips against datetimeLocalJstToUtcIso", () => {
    const local = "2026-05-22T10:00";
    const utc = datetimeLocalJstToUtcIso(local);
    expect(utcIsoToDatetimeLocalJst(utc)).toBe(local);
  });

  it("produces YYYY-MM-DDTHH:MM with zero-padding", () => {
    // 2026-01-02 03:04 JST = 2026-01-01 18:04 UTC
    const out = utcIsoToDatetimeLocalJst("2026-01-01T18:04:00Z");
    expect(out).toBe("2026-01-02T03:04");
  });
});
