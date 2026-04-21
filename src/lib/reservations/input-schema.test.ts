import { describe, expect, it } from "vitest";
import { reservationInputSchema } from "./input-schema";

const validInput = {
  parentName: "田中 太郎",
  parentKana: "たなか たろう",
  childName: "田中 花子",
  childKana: "たなか はなこ",
  phone: "090-1234-5678",
  email: "tanaka@example.com",
  notes: "アレルギーはありません。",
};

describe("reservationInputSchema", () => {
  it("accepts a well-formed reservation", () => {
    const result = reservationInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts long-dash and full-width space in kana", () => {
    const result = reservationInputSchema.safeParse({
      ...validInput,
      parentKana: "さとう　みすずー",
    });
    expect(result.success).toBe(true);
  });

  it("rejects kana fields that contain katakana or kanji", () => {
    const katakana = reservationInputSchema.safeParse({
      ...validInput,
      parentKana: "タナカ",
    });
    expect(katakana.success).toBe(false);

    const kanji = reservationInputSchema.safeParse({
      ...validInput,
      childKana: "田中",
    });
    expect(kanji.success).toBe(false);

    const latin = reservationInputSchema.safeParse({
      ...validInput,
      parentKana: "tanaka",
    });
    expect(latin.success).toBe(false);
  });

  it("rejects empty required strings after trim", () => {
    const blankName = reservationInputSchema.safeParse({
      ...validInput,
      parentName: "   ",
    });
    expect(blankName.success).toBe(false);
  });

  it("rejects an invalid phone number", () => {
    const badPhone = reservationInputSchema.safeParse({
      ...validInput,
      phone: "abc-def",
    });
    expect(badPhone.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const badEmail = reservationInputSchema.safeParse({
      ...validInput,
      email: "not-an-email",
    });
    expect(badEmail.success).toBe(false);
  });

  it("caps notes at 500 characters", () => {
    const longNotes = reservationInputSchema.safeParse({
      ...validInput,
      notes: "あ".repeat(501),
    });
    expect(longNotes.success).toBe(false);

    const maxNotes = reservationInputSchema.safeParse({
      ...validInput,
      notes: "あ".repeat(500),
    });
    expect(maxNotes.success).toBe(true);
  });

  it("normalizes an empty notes string to undefined", () => {
    const result = reservationInputSchema.parse({
      ...validInput,
      notes: "   ",
    });
    expect(result.notes).toBeUndefined();
  });

  it("treats notes as optional", () => {
    const without = { ...validInput };
    delete (without as Partial<typeof without>).notes;
    const result = reservationInputSchema.safeParse(without);
    expect(result.success).toBe(true);
  });
});
