import { describe, expect, it } from "vitest";

import { renderCanceledEmail } from "./canceled";
import { renderConfirmedEmail } from "./confirmed";
import { renderPromotedEmail } from "./promoted";
import { renderWaitlistedEmail } from "./waitlisted";

const baseCtx = {
  parentName: "田中 太郎",
  facilityName: "大洲児童館",
  clubName: "こども英会話（初級）",
  clubStartAt: "2026-05-10T01:00:00Z", // JST 10:00
  clubEndAt: "2026-05-10T03:00:00Z", // JST 12:00
  reservationNumber: "ozu_123456",
  secureToken: "A".repeat(32),
} as const;

describe("reservation email templates", () => {
  describe("renderConfirmedEmail", () => {
    it("includes the reservation number in subject and body, plus the confirmation URL", () => {
      const out = renderConfirmedEmail(baseCtx);
      expect(out.subject).toContain("ozu_123456");
      expect(out.text).toContain(baseCtx.parentName);
      expect(out.text).toContain(baseCtx.facilityName);
      expect(out.text).toContain(baseCtx.clubName);
      expect(out.text).toContain("ozu_123456");
      expect(out.text).toMatch(/\/reservations\?r=ozu_123456&t=/);
    });

    it("does not leak the secure_token in the subject", () => {
      const out = renderConfirmedEmail(baseCtx);
      expect(out.subject).not.toContain(baseCtx.secureToken);
    });
  });

  describe("renderWaitlistedEmail", () => {
    it("shows the waitlist position", () => {
      const out = renderWaitlistedEmail({ ...baseCtx, waitlistPosition: 3 });
      expect(out.subject).toContain("キャンセル待ち");
      expect(out.text).toContain("3 番目");
    });
  });

  describe("renderPromotedEmail", () => {
    it("signals that the reservation has been promoted to confirmed", () => {
      const out = renderPromotedEmail(baseCtx);
      expect(out.subject).toContain("繰り上がり");
      expect(out.text).toContain("繰り上がり");
      expect(out.text).toContain(baseCtx.reservationNumber);
    });
  });

  describe("renderCanceledEmail", () => {
    it("acknowledges the cancellation and does not include a URL", () => {
      const out = renderCanceledEmail({
        parentName: baseCtx.parentName,
        facilityName: baseCtx.facilityName,
        clubName: baseCtx.clubName,
        clubStartAt: baseCtx.clubStartAt,
        clubEndAt: baseCtx.clubEndAt,
        reservationNumber: baseCtx.reservationNumber,
      });
      expect(out.subject).toContain("キャンセル");
      expect(out.text).toContain("キャンセル");
      expect(out.text).not.toContain("/reservations?");
    });
  });
});
