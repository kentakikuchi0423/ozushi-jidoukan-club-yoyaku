import { describe, expect, it } from "vitest";

import { renderCanceledEmail } from "./canceled";
import { renderConfirmedEmail } from "./confirmed";
import { renderPromotedEmail } from "./promoted";
import type { FacilityContact } from "./shared";
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

const baseFacilities: ReadonlyArray<FacilityContact> = [
  { name: "大洲児童館", phone: "0893-24-2285" },
  { name: "喜多児童館", phone: "0893-24-2722" },
  { name: "徳森児童センター", phone: "0893-25-4735" },
];

describe("reservation email templates", () => {
  describe("renderConfirmedEmail", () => {
    it("includes the reservation number in subject and body, plus the confirmation URL", () => {
      const out = renderConfirmedEmail(baseCtx, baseFacilities);
      expect(out.subject).toContain("ozu_123456");
      expect(out.text).toContain(baseCtx.parentName);
      expect(out.text).toContain(baseCtx.facilityName);
      expect(out.text).toContain(baseCtx.clubName);
      expect(out.text).toContain("ozu_123456");
      expect(out.text).toMatch(/\/reservations\?r=ozu_123456&t=/);
    });

    it("does not leak the secure_token in the subject", () => {
      const out = renderConfirmedEmail(baseCtx, baseFacilities);
      expect(out.subject).not.toContain(baseCtx.secureToken);
    });

    it("lists every facility name and phone in the footer", () => {
      const out = renderConfirmedEmail(baseCtx, baseFacilities);
      for (const f of baseFacilities) {
        expect(out.text).toContain(f.name);
        expect(out.text).toContain(f.phone);
      }
    });
  });

  describe("renderWaitlistedEmail", () => {
    it("shows the waitlist position", () => {
      const out = renderWaitlistedEmail(
        { ...baseCtx, waitlistPosition: 3 },
        baseFacilities,
      );
      expect(out.subject).toContain("キャンセル待ち");
      expect(out.text).toContain("3 番目");
    });
  });

  describe("renderPromotedEmail", () => {
    it("signals that the reservation has been promoted to confirmed", () => {
      const out = renderPromotedEmail(baseCtx, baseFacilities);
      expect(out.subject).toContain("繰り上がり");
      expect(out.text).toContain("繰り上がり");
      expect(out.text).toContain(baseCtx.reservationNumber);
    });
  });

  describe("renderCanceledEmail", () => {
    it("acknowledges the cancellation and does not include a URL", () => {
      const out = renderCanceledEmail(
        {
          parentName: baseCtx.parentName,
          facilityName: baseCtx.facilityName,
          clubName: baseCtx.clubName,
          clubStartAt: baseCtx.clubStartAt,
          clubEndAt: baseCtx.clubEndAt,
          reservationNumber: baseCtx.reservationNumber,
        },
        baseFacilities,
      );
      expect(out.subject).toContain("キャンセル");
      expect(out.text).toContain("キャンセル");
      expect(out.text).not.toContain("/reservations?");
    });
  });
});
