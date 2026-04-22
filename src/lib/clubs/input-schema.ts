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
);

export const clubInputSchema = z.preprocess(
  preprocessInput,
  z
    .object({
      facilityCode: facilityCodeSchema,
      name: z.string().min(1).max(100),
      startAt: z.string().regex(datetimeLocalRegex, {
        message: "日時の形式が正しくありません",
      }),
      endAt: z.string().regex(datetimeLocalRegex, {
        message: "日時の形式が正しくありません",
      }),
      capacity: z.number().int().min(1).max(1000),
      targetAgeMin: z.number().int().min(0).max(120).nullable(),
      targetAgeMax: z.number().int().min(0).max(120).nullable(),
      photoUrl: z
        .string()
        .max(2048)
        .refine((v) => v === "" || photoUrlRegex.test(v), {
          message: "http:// または https:// で始まる URL を入力してください",
        })
        .transform((v) => (v === "" ? null : v))
        .nullable(),
      description: z
        .string()
        .max(2000)
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
