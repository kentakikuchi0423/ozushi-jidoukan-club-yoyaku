"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { cancelReservationAction } from "./actions";

type Stage = "idle" | "confirming" | "done";

interface Props {
  reservationNumber: string;
  secureToken: string;
  deadlineLabel: string;
}

export function CancelForm({
  reservationNumber,
  secureToken,
  deadlineLabel,
}: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // E2E でハイドレーション完了を検知するためのマーカー
  useEffect(() => {
    document.documentElement.dataset.cancelFormReady = "true";
    return () => {
      delete document.documentElement.dataset.cancelFormReady;
    };
  }, []);

  function handleCancelClick() {
    setError(null);
    setStage("confirming");
  }

  function handleBack() {
    setStage("idle");
    setError(null);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelReservationAction(
        reservationNumber,
        secureToken,
      );
      if (result.ok) {
        setStage("done");
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <section className="mt-8 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-zinc-700">予約のキャンセル</h2>
      <p className="text-xs leading-5 text-zinc-600">
        キャンセルは <strong>{deadlineLabel}</strong> までお手続きいただけます。
        <br />
        それ以降のキャンセルや無断欠席は他の利用者への影響が大きいため原則お控えください。
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm whitespace-pre-line text-red-800"
        >
          {error}
        </p>
      )}

      {stage === "idle" && (
        <button
          type="button"
          onClick={handleCancelClick}
          className="w-full rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 sm:w-auto"
        >
          この予約をキャンセルする
        </button>
      )}

      {stage === "confirming" && (
        <div className="space-y-3 rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-900">
            本当にこの予約をキャンセルしますか？
            <br />
            この操作は取り消せません。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleBack}
              disabled={pending}
              className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 sm:w-auto"
            >
              やめる
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 sm:w-auto"
            >
              {pending ? "キャンセル処理中…" : "キャンセルを確定する"}
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          キャンセルが完了しました。
          <br />
          ページの表示を更新しています。
        </p>
      )}
    </section>
  );
}
