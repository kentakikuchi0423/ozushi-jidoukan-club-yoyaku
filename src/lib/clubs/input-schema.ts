import { z } from "zod";

import { FACILITY_CODES, type FacilityCode } from "@/lib/facility";

// 管理画面のクラブ登録・編集フォームの zod スキーマ。
//
// 日時は `<input type="datetime-local">` の形式（`YYYY-MM-DDTHH:MM`）で
// 受け取る。サーバー側で Asia/Tokyo とみなして UTC に変換する。
// DB 側では `timestamptz` で UTC 保存（ADR-0010）。

const datetimeLocalRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
const photoUrlRegex = /^https?:\/\//;

function trimString<T>(value: T): T {
  if (typeof value === "string") return value.trim() as T;
  return value;
}

function preprocessInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = trimString(value);
  }
  return out;
}

const facilityCodeSchema = z.enum(
  FACILITY_CODES as unknown as [FacilityCode, ...FacilityCode[]],
  { message: "館を選択してください" },
);

export const clubInputSchema = z.preprocess(
  preprocessInput,
  z
    .object({
      facilityCode: facilityCodeSchema,
      name: z
        .string()
        .min(1, { message: "クラブ名を入力してください" })
        .max(100, { message: "クラブ名は 100 字以内で入力してください" }),
      startAt: z.string().regex(datetimeLocalRegex, {
        message: "日時の形式が正しくありません",
      }),
      endAt: z.string().regex(datetimeLocalRegex, {
        message: "日時の形式が正しくありません",
      }),
      capacity: z
        .number({ message: "定員を数値で入力してください" })
        .int({ message: "定員は整数で入力してください" })
        .min(1, { message: "定員は 1 名以上で入力してください" })
        .max(1000, { message: "定員は 1000 名以下で入力してください" }),
      targetAgeMin: z
        .number({ message: "対象年齢を数値で入力してください" })
        .int({ message: "対象年齢は整数で入力してください" })
        .min(0, { message: "対象年齢は 0 歳以上で入力してください" })
        .max(120, { message: "対象年齢は 120 歳以下で入力してください" })
        .nullable(),
      targetAgeMax: z
        .number({ message: "対象年齢を数値で入力してください" })
        .int({ message: "対象年齢は整数で入力してください" })
        .min(0, { message: "対象年齢は 0 歳以上で入力してください" })
        .max(120, { message: "対象年齢は 120 歳以下で入力してください" })
        .nullable(),
      photoUrl: z
        .string()
        .max(2048, { message: "写真 URL が長すぎます（2048 字まで）" })
        .refine((v) => v === "" || photoUrlRegex.test(v), {
          message: "http:// または https:// で始まる URL を入力してください",
        })
        .transform((v) => (v === "" ? null : v))
        .nullable(),
      description: z
        .string()
        .max(2000, { message: "説明は 2000 字以内で入力してください" })
        .transform((v) => (v === "" ? null : v))
        .nullable(),
    })
    .refine(
      (data) => {
        const s = new Date(
          `${data.startAt}${data.startAt.length === 16 ? ":00" : ""}+09:00`,
        ).getTime();
        const e = new Date(
          `${data.endAt}${data.endAt.length === 16 ? ":00" : ""}+09:00`,
        ).getTime();
        return e > s;
      },
      {
        message: "終了時刻は開始時刻より後に設定してください",
        path: ["endAt"],
      },
    )
    .refine(
      (data) =>
        data.targetAgeMin === null ||
        data.targetAgeMax === null ||
        data.targetAgeMax >= data.targetAgeMin,
      {
        message: "対象年齢の最大は最小以上にしてください",
        path: ["targetAgeMax"],
      },
    ),
);

export type ClubInput = z.infer<typeof clubInputSchema>;
