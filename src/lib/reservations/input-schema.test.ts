import { describe, expect, it } from "vitest";
import { reservationInputSchema } from "./input-schema";

const validInput = {
  parents: [{ name: "田中 太郎", kana: "たなか たろう" }],
  children: [{ name: "田中 花子", kana: "たなか はなこ" }],
  phone: "090-1234-5678",
  email: "tanaka@example.com",
  notes: "アレルギーはありません。",
};

describe("reservationInputSchema", () => {
  it("accepts a well-formed single-person reservation", () => {
    const result = reservationInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts multiple parents and children", () => {
    const result = reservationInputSchema.safeParse({
      ...validInput,
      parents: [
        { name: "田中 太郎", kana: "たなか たろう" },
        { name: "田中 花子", kana: "たなか はなこ" },
      ],
      children: [
        { name: "田中 一郎", kana: "たなか いちろう" },
        { name: "田中 二郎", kana: "たなか じろう" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parents).toHaveLength(2);
      expect(result.data.children).toHaveLength(2);
    }
  });

  it("allows an empty parents array (optional)", () => {
    const result = reservationInputSchema.safeParse({
      ...validInput,
      parents: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parents).toEqual([]);
    }
  });

  it("defaults parents to [] when absent", () => {
    const noParents = { ...validInput } as Partial<typeof validInput>;
    delete noParents.parents;
    const result = reservationInputSchema.safeParse(noParents);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parents).toEqual([]);
    }
  });

  it("rejects an empty children array", () => {
    const result = reservationInputSchema.safeParse({
      ...validInput,
      children: [],
    });
    expect(result.success).toBe(false);
  });

  it("caps parents and children at 10 each", () => {
    const person = { name: "田中 太郎", kana: "たなか たろう" };
    const tooMany = {
      ...validInput,
      parents: Array.from({ length: 11 }, () => person),
    };
    expect(reservationInputSchema.safeParse(tooMany).success).toBe(false);
  });

  it("accepts long-dash and full-width space in kana", () => {
    const result = reservationInputSchema.safeParse({
      ...validInput,
      parents: [{ name: "佐藤 みすず", kana: "さとう　みすずー" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects kana fields that contain katakana or kanji", () => {
    const katakana = reservationInputSchema.safeParse({
      ...validInput,
      parents: [{ name: "田中", kana: "タナカ" }],
    });
    expect(katakana.success).toBe(false);

    const kanji = reservationInputSchema.safeParse({
      ...validInput,
      children: [{ name: "田中", kana: "田中" }],
    });
    expect(kanji.success).toBe(false);

    const latin = reservationInputSchema.safeParse({
      ...validInput,
      parents: [{ name: "Tanaka", kana: "tanaka" }],
    });
    expect(latin.success).toBe(false);
  });

  it("rejects empty required strings after trim", () => {
    const blankName = reservationInputSchema.safeParse({
      ...validInput,
      parents: [{ name: "   ", kana: "たなか" }],
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

  it("normalizes full-width digits/space/paren in phone to half-width", () => {
    const cases = [
      "０９０-１２３４-５６７８",
      "090　1234　5678",
      "(090)1234-5678",
      "（090）1234-5678",
    ];
    for (const phone of cases) {
      const result = reservationInputSchema.safeParse({ ...validInput, phone });
      expect(result.success, `failed for ${phone}`).toBe(true);
      if (result.success) {
        expect(result.data.phone).toMatch(/^[0-9+\-() ]{7,20}$/);
      }
    }
  });

  it("normalizes full-width characters in email to half-width", () => {
    const result = reservationInputSchema.safeParse({
      ...validInput,
      email: "ＴＥＳＴ@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("TEST@example.com");
    }
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
