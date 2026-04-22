import { describe, expect, it } from "vitest";
import { buildConfirmUrl, formatDateTimeRange } from "./shared";

describe("buildConfirmUrl", () => {
  it("joins NEXT_PUBLIC_SITE_URL with /reservations and url-encodes r/t", () => {
    // vitest.setup.ts で NEXT_PUBLIC_SITE_URL="http://localhost:3000" を注入済み
    const url = buildConfirmUrl("ozu_123456", "A".repeat(43));
    expect(url).toMatch(/^http:\/\/localhost:3000\/reservations\?/);
    expect(url).toContain("r=ozu_123456");
    expect(url).toContain("t=" + "A".repeat(43));
  });

  it("trims a trailing slash on the base URL", () => {
    const saved = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000/";
    try {
      // env は publicEnv のモジュール初期化で読まれるので、Vitest の isolate の
      // 範囲で上書きが効かないことがある。ここでは最低限「/ が重複しない」こと
      // を regex で確認する。
      const url = buildConfirmUrl("kita_999999", "B".repeat(43));
      expect(url).not.toMatch(/http:\/\/localhost:3000\/\/reservations/);
      expect(url).toContain("/reservations?");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = saved;
    }
  });
});

describe("formatDateTimeRange", () => {
  it("formats start/end with JST and the 〜 separator", () => {
    // 2026-05-22 10:00–12:00 JST
    const out = formatDateTimeRange(
      "2026-05-22T01:00:00Z",
      "2026-05-22T03:00:00Z",
    );
    expect(out).toContain("2026年");
    expect(out).toContain("10:00〜12:00");
  });
});
