import { describe, expect, it } from "vitest";
import { clubInputSchema, programInputSchema } from "./input-schema";

const validProgramId = "11111111-1111-4111-8111-111111111111";

const valid = {
  facilityCode: "ozu",
  programId: validProgramId,
  startAt: "2026-05-22T10:00",
  endAt: "2026-05-22T12:00",
  capacity: 10,
  photoUrl: "https://example.com/photo.jpg",
  description: "動作確認用のテストクラブです。",
};

describe("clubInputSchema", () => {
  it("accepts a well-formed club payload", () => {
    const result = clubInputSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects a malformed facilityCode", () => {
    // 大文字始まりや特殊文字は形式チェックで落ちる。
    // 実在するかは action 側で DB 参照して確認する。
    expect(
      clubInputSchema.safeParse({ ...valid, facilityCode: "XXX" }).success,
    ).toBe(false);
    expect(
      clubInputSchema.safeParse({ ...valid, facilityCode: "1bc" }).success,
    ).toBe(false);
    expect(
      clubInputSchema.safeParse({ ...valid, facilityCode: "" }).success,
    ).toBe(false);
  });

  it("rejects a missing programId", () => {
    const result = clubInputSchema.safeParse({ ...valid, programId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a programId that is not a valid UUID", () => {
    const result = clubInputSchema.safeParse({
      ...valid,
      programId: "not-a-uuid",
    });
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

  it("accepts empty photo/description and stores them as null", () => {
    const result = clubInputSchema.safeParse({
      ...valid,
      photoUrl: "",
      description: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.photoUrl).toBeNull();
      expect(result.data.description).toBeNull();
    }
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

describe("programInputSchema", () => {
  const validProgram = {
    name: "にこにこクラブ",
    targetAge: "０・１歳児の親子",
    summary: "テスト用の概要文です。",
  };

  it("accepts a well-formed program", () => {
    const result = programInputSchema.safeParse(validProgram);
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = programInputSchema.safeParse({
      ...validProgram,
      name: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty target age", () => {
    const result = programInputSchema.safeParse({
      ...validProgram,
      targetAge: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects summaries longer than 2000 characters", () => {
    const result = programInputSchema.safeParse({
      ...validProgram,
      summary: "あ".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
