import { z } from "zod";

// 利用者予約フォームのサーバー側 zod スキーマ。
//
// CLAUDE.md / docs/requirements.md の固定要件に合わせる:
//   * 1 件の予約に保護者・子どもを複数人登録できる（いずれも 1 〜 10 人）
//   * 各人の氏名ふりがなは「ひらがなのみ」をサーバー側で検証する
//   * 電話番号は国内形式（数字 + ハイフン + 記号）、メールは RFC 5322 の簡易検証
//   * 備考は 500 文字以内
//
// DB 側（reservations / reservation_parents / reservation_children の CHECK 制約）
// でも同等の検査を行う二重防御。Node 側で先に弾けば UX が早く戻せる。
// 両者の regex を厳密に合わせるため、zod の preprocess で入力を正規化する:
//   - 全フィールド: `.trim()`
//   - phone / email: さらに `.normalize("NFKC")` で半角化
//     （IME 経由で全角の数字・スペースが混入しても DB の CHECK に合わせる）

const MAX_PEOPLE = 10;

const hiragana = /^[぀-ゟー　\s]+$/;
// U+3040..U+309F: ひらがなブロック。U+30FC は長音記号（「ー」）。
// U+3000 は全角スペース。半角空白も許容。NFKC はひらがなを変形させないので
// phone 以外は正規化しない（日本語の自然さを保つため）。

const phoneRegex = /^[0-9+\-() ]{7,20}$/;
// DB 側の `reservations.phone` CHECK 制約と完全一致。
// NFKC で半角化した後の値を評価する前提。

const personSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: "お名前を入力してください" })
      .max(100, { message: "お名前は 100 字以内で入力してください" }),
    kana: z
      .string()
      .min(1, { message: "ふりがなを入力してください" })
      .max(100, { message: "ふりがなは 100 字以内で入力してください" })
      .regex(hiragana, { message: "ひらがなで入力してください" }),
  })
  .strict();

function trimPerson(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

function trimPeopleArray(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map(trimPerson);
}

function normalizeTopLevel(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  if ("parents" in src) out.parents = trimPeopleArray(src.parents);
  if ("children" in src) out.children = trimPeopleArray(src.children);
  if (typeof src.phone === "string") {
    out.phone = src.phone.trim().normalize("NFKC");
  }
  if (typeof src.email === "string") {
    out.email = src.email.trim().normalize("NFKC");
  }
  if (typeof src.notes === "string") {
    out.notes = src.notes.trim();
  }
  return out;
}

export const reservationInputSchema = z.preprocess(
  normalizeTopLevel,
  z.object({
    // 保護者は任意（0 名でも OK）。入力した場合は各行で name/kana を要求する。
    parents: z
      .array(personSchema)
      .max(MAX_PEOPLE, { message: `保護者は ${MAX_PEOPLE} 名までです` })
      .default([]),
    children: z
      .array(personSchema)
      .min(1, { message: "お子さまを 1 名以上入力してください" })
      .max(MAX_PEOPLE, { message: `お子さまは ${MAX_PEOPLE} 名までです` }),
    phone: z
      .string()
      .regex(phoneRegex, { message: "電話番号の形式が正しくありません" }),
    email: z
      .string()
      .email({ message: "メールアドレスの形式が正しくありません" })
      .max(320, { message: "メールアドレスが長すぎます" }),
    notes: z
      .string()
      .max(500, { message: "備考は 500 字以内で入力してください" })
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  }),
);

export type ReservationInput = z.infer<typeof reservationInputSchema>;
export type ReservationPersonInput = z.infer<typeof personSchema>;
