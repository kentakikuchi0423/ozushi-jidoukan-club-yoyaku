import { z } from "zod";

// 利用者予約フォームのサーバー側 zod スキーマ。
//
// CLAUDE.md / docs/requirements.md の固定要件に合わせる:
//   * 保護者／子どもの名前ふりがなは「ひらがなのみ」をサーバー側で検証する
//   * 電話番号は国内形式（数字 + ハイフン + 記号）
//   * メールは RFC 5322 の簡易検証
//   * 備考は 500 文字以内
//
// DB 側（reservations の CHECK 制約）でも同等の検査を行う二重防御。Node 側で
// 先に弾けば UX が早く戻せる。

const hiragana = /^[぀-ゟー　\s]+$/;
// U+3040..U+309F: ひらがなブロック。U+30FC は長音記号（「」の「ー」）。
// U+3000 は全角スペース。半角空白も許容。

const phone = /^[0-9+\-() 　]{7,20}$/;
// 数字 / ハイフン / カッコ / 空白（半角・全角）を許容。+ は国際表記用の頭につく可能性があるため許容。

export const reservationInputSchema = z.object({
  parentName: z.string().trim().min(1).max(100),
  parentKana: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(hiragana, { message: "ひらがなで入力してください" }),
  childName: z.string().trim().min(1).max(100),
  childKana: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(hiragana, { message: "ひらがなで入力してください" }),
  phone: z
    .string()
    .trim()
    .regex(phone, { message: "電話番号の形式が正しくありません" }),
  email: z.string().trim().email().max(320),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type ReservationInput = z.infer<typeof reservationInputSchema>;
