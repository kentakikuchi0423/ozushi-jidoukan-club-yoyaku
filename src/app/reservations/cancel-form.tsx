"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { FormMessage } from "@/components/ui";

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
    <section className="mt-8 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
        予約のキャンセル
      </h2>
      <p className="text-xs leading-5 text-[var(--color-muted)]">
        キャンセルは <strong>{deadlineLabel}</strong> までお手続きいただけます。
        <br />
        それ以降のキャンセルや無断欠席は他の利用者への影響が大きいため原則お控えください。
      </p>

      {error && <FormMessage tone="danger">{error}</FormMessage>}

      {stage === "idle" && (
        <button
          type="button"
          onClick={handleCancelClick}
          className="w-full rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)] sm:w-auto"
        >
          この予約をキャンセルする
        </button>
      )}

      {stage === "confirming" && (
        <div className="space-y-3 rounded-xl bg-[var(--color-danger-soft)] p-3">
          <p className="text-sm text-[var(--color-danger)]">
            本当にこの予約をキャンセルしますか？
            <br />
            この操作は取り消せません。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleBack}
              disabled={pending}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-60 sm:w-auto"
            >
              やめる
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className="w-full rounded-xl bg-[var(--color-danger)] px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 sm:w-auto"
            >
              {pending ? "キャンセル処理中…" : "キャンセルを確定する"}
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <FormMessage tone="success">
          キャンセルが完了しました。{"\n"}ページの表示を更新しています。
        </FormMessage>
      )}
    </section>
  );
}
