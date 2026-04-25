"use server";

import { redirect } from "next/navigation";

import { fetchClubDetail } from "@/lib/clubs/query";
import { reservationInputSchema } from "@/lib/reservations/input-schema";
import { notifyReservationCreated } from "@/server/mail/notify";
import {
  createReservation,
  ReservationConflictError,
  ReservationInputError,
} from "@/server/reservations/create";

// Client Component から呼ばれる Server Action。
//
// 成功時は `/clubs/[id]/done?r=...&t=...` に `redirect()` する。redirect は
// 例外として throw されるため、try/catch の外側に置いて握りつぶさない。
// 失敗時は型付きのエラーを serialize して返し、フォーム側でメッセージ表示する。
// secure_token は Node 側で生成された値をそのまま確認 URL の query に乗せる
// 設計（ADR-0004 / ADR-0006）。

export type ReservationActionResult =
  | { ok: false; kind: "input"; fieldErrors: Record<string, string> }
  | { ok: false; kind: "conflict"; message: string }
  | { ok: false; kind: "unknown"; message: string };

export async function createReservationAction(
  clubId: string,
  rawInput: unknown,
): Promise<ReservationActionResult | never> {
  // 1) server-side でも zod でバリデーション
  const parsed = reservationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map((p) => String(p)).join(".") || "_form";
      if (!(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, kind: "input", fieldErrors };
  }

  // 2) RPC 呼び出し（createReservation 内でも同じ検証が走る二重防御）
  let result: Awaited<ReturnType<typeof createReservation>>;
  try {
    result = await createReservation(clubId, parsed.data);
  } catch (error) {
    if (error instanceof ReservationInputError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "_form";
        if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
      }
      return { ok: false, kind: "input", fieldErrors };
    }
    if (error instanceof ReservationConflictError) {
      console.error("[reservations.create] action rejected as conflict", {
        tag: "reservation.conflict",
        message: error.message,
      });
      return {
        ok: false,
        kind: "conflict",
        message:
          "ただいま予約処理が混み合っています。\n少し時間をおいて、もう一度お試しください。",
      };
    }
    console.error("[reservations.create] action unknown error", {
      tag: "reservation.unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      kind: "unknown",
      message:
        "予期しないエラーが発生しました。\nページを再読み込みしてもう一度お試しください。",
    };
  }

  // 3) 通知メール送信（fire-and-forget。失敗してもユーザー導線は止めない）
  //    status が 'canceled' で返ることはないため narrowing だけ行う
  if (result.status !== "canceled") {
    try {
      const club = await fetchClubDetail(clubId);
      if (club) {
        await notifyReservationCreated({
          reservationNumber: result.reservationNumber,
          secureToken: result.secureToken,
          status: result.status,
          waitlistPosition: result.waitlistPosition,
          email: parsed.data.email,
          facilityName: club.facilityName,
          clubName: club.name,
          clubStartAt: club.startAt,
          clubEndAt: club.endAt,
        });
      }
    } catch (mailError) {
      console.error("[mail] notifyReservationCreated failed", {
        tag: "reservation.created",
        error:
          mailError instanceof Error ? mailError.message : String(mailError),
      });
    }
  }

  // 4) redirect（try/catch の外で throw する）
  const params = new URLSearchParams({
    r: result.reservationNumber,
    t: result.secureToken,
    s: result.status,
  });
  if (result.waitlistPosition !== null) {
    params.set("p", String(result.waitlistPosition));
  }
  redirect(`/clubs/${clubId}/done?${params.toString()}`);
}
