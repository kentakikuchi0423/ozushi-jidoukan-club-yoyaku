import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  reservationInputSchema,
  type ReservationInput,
} from "@/lib/reservations/input-schema";
import type { ReservationStatus } from "@/lib/reservations/status";
import { generateSecureToken } from "./secure-token";

export interface CreateReservationResult {
  reservationNumber: string;
  secureToken: string;
  status: ReservationStatus;
  waitlistPosition: number | null;
}

export interface ReservationInputIssue {
  readonly path: ReadonlyArray<string>;
  readonly message: string;
}

export class ReservationInputError extends Error {
  constructor(public readonly issues: ReadonlyArray<ReservationInputIssue>) {
    super("reservation input validation failed");
    this.name = "ReservationInputError";
  }
}

export class ReservationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationConflictError";
  }
}

interface CreateReservationRow {
  reservation_number: string;
  status: ReservationStatus;
  waitlist_position: number | null;
}

/**
 * 予約を確定または予約待ちで登録する。
 *
 * 入力は zod で検証し、失敗時は ReservationInputError（type="*Input*"）。
 * RPC 内で行ロック + シーケンス更新 + INSERT を 1 トランザクションで実行する
 * ので、同時予約で定員超過は発生しない（ADR-0005）。
 * secure_token は Node 側で Web Crypto を用いて生成し、RPC の引数として渡す。
 */
export async function createReservation(
  clubId: string,
  rawInput: unknown,
): Promise<CreateReservationResult> {
  const parsed = reservationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ReservationInputError(
      parsed.error.issues.map((issue) => ({
        path: issue.path.map((segment) => String(segment)),
        message: issue.message,
      })),
    );
  }

  const input: ReservationInput = parsed.data;
  const secureToken = generateSecureToken();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_reservation", {
    p_club_id: clubId,
    p_secure_token: secureToken,
    p_parent_name: input.parentName,
    p_parent_kana: input.parentKana,
    p_child_name: input.childName,
    p_child_kana: input.childKana,
    p_phone: input.phone,
    p_email: input.email,
    p_notes: input.notes ?? null,
  });

  if (error) {
    // DB の CHECK 制約違反などは `details` に行の値が入ってくるので
    // PII が漏れないよう `code` / `message` / `hint` のみログに残す。
    console.error("[reservations.create] RPC error", {
      code: error.code,
      message: error.message,
      hint: error.hint,
    });
    throw new ReservationConflictError(
      `create_reservation RPC failed: ${error.message}`,
    );
  }

  const row = Array.isArray(data) ? data[0] : (data as CreateReservationRow);
  if (!row) {
    throw new ReservationConflictError("create_reservation returned no row");
  }

  return {
    reservationNumber: row.reservation_number,
    secureToken,
    status: row.status,
    waitlistPosition: row.waitlist_position,
  };
}
