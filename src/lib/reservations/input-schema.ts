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
// 先に弾けば UX が早く戻せる。両者の regex を厳密に合わせるため、zod の
// preprocess で入力を正規化する:
//   - 全フィールド: `.trim()`
//   - phone / email: さらに `.normalize("NFKC")` で半角化
//     （IME 経由で全角の数字・スペースが混入しても DB の CHECK に合わせる）

const hiragana = /^[぀-ゟー　\s]+$/;
// U+3040..U+309F: ひらがなブロック。U+30FC は長音記号（「ー」）。
// U+3000 は全角スペース。半角空白も許容。NFKC はひらがなを変形させないので
// phone 以外は正規化しない（日本語の自然さを保つため）。

const phoneRegex = /^[0-9+\-() ]{7,20}$/;
// DB 側の `reservations.phone` CHECK 制約と完全一致。
// NFKC で半角化した後の値を評価する前提。

function asNormalizedString(key: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  // phone / email だけは NFKC で全角 → 半角に寄せる
  if (key === "phone" || key === "email") {
    return trimmed.normalize("NFKC");
  }
  return trimmed;
}

function preprocessInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = asNormalizedString(key, value);
  }
  return out;
}

export const reservationInputSchema = z.preprocess(
  preprocessInput,
  z.object({
    parentName: z.string().min(1).max(100),
    parentKana: z
      .string()
      .min(1)
      .max(100)
      .regex(hiragana, { message: "ひらがなで入力してください" }),
    childName: z.string().min(1).max(100),
    childKana: z
      .string()
      .min(1)
      .max(100)
      .regex(hiragana, { message: "ひらがなで入力してください" }),
    phone: z
      .string()
      .regex(phoneRegex, { message: "電話番号の形式が正しくありません" }),
    email: z.string().email().max(320),
    notes: z
      .string()
      .max(500)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  }),
);

export type ReservationInput = z.infer<typeof reservationInputSchema>;
