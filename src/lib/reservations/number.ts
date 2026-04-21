import { isFacilityCode, type FacilityCode } from "../facility";

export const RESERVATION_NUMBER_SEQUENCE_MIN = 100_000;
export const RESERVATION_NUMBER_SEQUENCE_MAX = 999_999;

export const RESERVATION_NUMBER_REGEX = /^(ozu|kita|toku)_(\d{6})$/;

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
  if (!isFacilityCode(code)) return null;
  return { code, sequence: Number(match[2]) };
}

export function isReservationNumber(value: unknown): value is string {
  return typeof value === "string" && RESERVATION_NUMBER_REGEX.test(value);
}
