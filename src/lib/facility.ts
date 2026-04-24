// 館（児童館・児童センター）マスターの型とフォーマット定義。
//
// 以前は 3 館固定だったが、管理画面から追加・編集できるようにしたため
// 実行時のマスターデータは DB（public.facilities）が正とする。
// `FacilityCode` は自由文字列だが形式は `FACILITY_CODE_REGEX` で縛る。
// 具体的な名称や電話番号は `src/server/facilities/list.ts` の
// `fetchFacilities()` / `fetchFacilityByCode()` を使って取得する。

/** 予約番号の prefix としても使われる館コード。例: "ozu", "kita", "toku", "new" 等。 */
export type FacilityCode = string;

/**
 * 館コードのフォーマット。
 *   - 小文字アルファベット 1 文字で始まる
 *   - 続く文字は英小文字または数字
 *   - 全体で 2〜10 文字
 *
 * DB 側の `facilities_code_check` 制約とも一致させる。
 * 予約番号 `ozu_123456` のような形で利用されるため、文字数や形式を厳しめに制限。
 */
export const FACILITY_CODE_REGEX = /^[a-z][a-z0-9]{1,9}$/;

export function isFacilityCodeFormat(value: string): boolean {
  return FACILITY_CODE_REGEX.test(value);
}
