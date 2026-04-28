import { describe, expect, it } from "vitest";

import { renderLoginAlertEmail } from "./login-alert";
import type { FacilityContact } from "./shared";

const facilities: ReadonlyArray<FacilityContact> = [
  { name: "大洲児童館", phone: "0893-24-2285" },
  { name: "喜多児童館", phone: "0893-24-2722" },
  { name: "徳森児童センター", phone: "0893-25-4735" },
];

describe("renderLoginAlertEmail", () => {
  it("uses the display name as greeting when present", () => {
    const out = renderLoginAlertEmail(
      {
        email: "admin@example.com",
        displayName: "館長 太郎",
        failureCount: 5,
      },
      facilities,
    );
    expect(out.text.startsWith("館長 太郎 様")).toBe(true);
  });

  it("falls back to the email as greeting when display name is null", () => {
    const out = renderLoginAlertEmail(
      { email: "admin@example.com", displayName: null, failureCount: 5 },
      facilities,
    );
    expect(out.text.startsWith("admin@example.com 様")).toBe(true);
  });

  it("does not leak IP / timestamp / failure count into the body", () => {
    // ADR-0033: 詳細値（回数・IP・時刻）は本文に出さない方針
    const out = renderLoginAlertEmail(
      { email: "admin@example.com", displayName: null, failureCount: 7 },
      facilities,
    );
    // 「N 回」のような失敗回数の具体値を出さない
    expect(out.text).not.toMatch(/\d+\s*回/);
    // IPv4 を本文に書かない
    expect(out.text).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    // 「YYYY年M月D日」「HH:MM」のような時刻表記も出さない
    expect(out.text).not.toMatch(/\d{4}年\d{1,2}月\d{1,2}日/);
    expect(out.text).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });

  it("includes a password change link pointing at /admin/password", () => {
    const out = renderLoginAlertEmail(
      { email: "admin@example.com", displayName: null, failureCount: 5 },
      facilities,
    );
    expect(out.text).toMatch(/\/admin\/password\b/);
  });

  it("does not claim that the account is locked", () => {
    const out = renderLoginAlertEmail(
      { email: "admin@example.com", displayName: null, failureCount: 5 },
      facilities,
    );
    expect(out.text).toContain("アカウントがロックされたわけではありません");
  });

  it("emits a multipart-friendly HTML version", () => {
    const out = renderLoginAlertEmail(
      { email: "admin@example.com", displayName: null, failureCount: 5 },
      facilities,
    );
    expect(out.html).toBeDefined();
    expect(out.html).toContain("/admin/password");
  });

  it("subject identifies the system without leaking PII", () => {
    const out = renderLoginAlertEmail(
      {
        email: "leak@example.com",
        displayName: "リーク 太郎",
        failureCount: 99,
      },
      facilities,
    );
    expect(out.subject).toContain("大洲市児童館クラブ予約");
    expect(out.subject).not.toContain("leak@example.com");
    expect(out.subject).not.toContain("リーク 太郎");
    expect(out.subject).not.toContain("99");
  });

  it("lists every facility name and phone in the footer", () => {
    const out = renderLoginAlertEmail(
      { email: "admin@example.com", displayName: null, failureCount: 5 },
      facilities,
    );
    for (const f of facilities) {
      expect(out.text).toContain(f.name);
      expect(out.text).toContain(f.phone);
    }
  });
});
