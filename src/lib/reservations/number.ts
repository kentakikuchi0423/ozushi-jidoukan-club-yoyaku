import { isFacilityCodeFormat, type FacilityCode } from "../facility";

export const RESERVATION_NUMBER_SEQUENCE_MIN = 100_000;
export const RESERVATION_NUMBER_SEQUENCE_MAX = 999_999;

// 予約番号: `<facility_code>_<6-digit>`。facility_code は
// FACILITY_CODE_REGEX (`^[a-z][a-z0-9]{1,9}$`) と同じ形式。
// 予約番号全体の regex はグローバルに使うので `g` フラグを付けないこと。
export const RESERVATION_NUMBER_REGEX = /^([a-z][a-z0-9]{1,9})_(\d{6})$/;

export interface ParsedReservationNumber {
  code: FacilityCode;
  sequence: number;
}

export function buildReservationNumber(
  code: FacilityCode,
  sequence: number,
): string {
  if (!Number.isInteger(sequence)) {
    throw new TypeError(`sequence must be an integer: ${sequence}`);
  }
  if (
    sequence < RESERVATION_NUMBER_SEQUENCE_MIN ||
    sequence > RESERVATION_NUMBER_SEQUENCE_MAX
  ) {
    throw new RangeError(
      `sequence must be between ${RESERVATION_NUMBER_SEQUENCE_MIN} and ${RESERVATION_NUMBER_SEQUENCE_MAX}: ${sequence}`,
    );
  }
  return `${code}_${sequence}`;
}

export function parseReservationNumber(
  value: string,
): ParsedReservationNumber | null {
  const match = RESERVATION_NUMBER_REGEX.exec(value);
  if (!match) return null;
  const code = match[1];
  if (!isFacilityCodeFormat(code)) return null;
  return { code, sequence: Number(match[2]) };
}

export function isReservationNumber(value: unknown): value is string {
  return typeof value === "string" && RESERVATION_NUMBER_REGEX.test(value);
}
