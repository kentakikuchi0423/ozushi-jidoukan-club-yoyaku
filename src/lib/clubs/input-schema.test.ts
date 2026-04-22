import { describe, expect, it } from "vitest";
import { clubInputSchema } from "./input-schema";

const valid = {
  facilityCode: "ozu",
  name: "テスト用 こども英会話（初級）",
  startAt: "2026-05-22T10:00",
  endAt: "2026-05-22T12:00",
  capacity: 10,
  targetAgeMin: 3,
  targetAgeMax: 6,
  photoUrl: "https://example.com/photo.jpg",
  description: "動作確認用のテストクラブです。",
};

describe("clubInputSchema", () => {
  it("accepts a well-formed club payload", () => {
    const result = clubInputSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown facilityCode", () => {
    const result = clubInputSchema.safeParse({
      ...valid,
      facilityCode: "xxx",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a name that is empty after trim", () => {
    const result = clubInputSchema.safeParse({ ...valid, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed datetime-local string", () => {
    const result = clubInputSchema.safeParse({
      ...valid,
      startAt: "2026/05/22 10:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects end time before start time", () => {
    const result = clubInputSchema.safeParse({
      ...valid,
      startAt: "2026-05-22T12:00",
      endAt: "2026-05-22T10:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts nullable target_age pair and empty photo/description", () => {
    const result = clubInputSchema.safeParse({
      ...valid,
      targetAgeMin: null,
      targetAgeMax: null,
      photoUrl: "",
      description: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.photoUrl).toBeNull();
      expect(result.data.description).toBeNull();
    }
  });

  it("rejects target_age_max smaller than target_age_min", () => {
    const result = clubInputSchema.safeParse({
      ...valid,
      targetAgeMin: 6,
      targetAgeMax: 3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-http(s) photo URLs", () => {
    const result = clubInputSchema.safeParse({
      ...valid,
      photoUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("caps capacity at 1000 and requires integer >= 1", () => {
    expect(clubInputSchema.safeParse({ ...valid, capacity: 0 }).success).toBe(
      false,
    );
    expect(
      clubInputSchema.safeParse({ ...valid, capacity: 1001 }).success,
    ).toBe(false);
    expect(clubInputSchema.safeParse({ ...valid, capacity: 1.5 }).success).toBe(
      false,
    );
  });
});
