"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatJstDate, formatJstTime } from "@/lib/format";

import { publishClubAction } from "./actions";

interface Props {
  readonly clubId: string;
  /** 公開済みクラブはボタンをグレーアウトして「公開済み」表示にする。 */
  readonly alreadyPublished: boolean;
  /** 公開前確認ダイアログに載せるクラブ情報。 */
  readonly clubName: string;
  readonly facilityName: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly capacity: number;
  readonly targetAge: string;
}

export function PublishClubButton({
  clubId,
  alreadyPublished,
  clubName,
  facilityName,
  startAt,
  endAt,
  capacity,
  targetAge,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 楽観的に「公開済み」に切り替え、失敗したら戻す。
  const [optimisticPublished, setOptimisticPublished] =
    useState(alreadyPublished);

  function buildConfirmText(): string {
    const dateLabel = formatJstDate(startAt);
    const startLabel = formatJstTime(startAt);
    const endLabel = formatJstTime(endAt);
    return [
      "以下のクラブを公開します。よろしいですか？",
      "",
      `クラブ名: ${clubName}`,
      `館: ${facilityName}`,
      `開催日時: ${dateLabel} ${startLabel}〜${endLabel}`,
      `対象年齢: ${targetAge}`,
      `定員: ${capacity} 名`,
    ].join("\n");
  }

  function handleClick() {
    if (optimisticPublished) return;
    if (!window.confirm(buildConfirmText())) return;
    setError(null);
    setOptimisticPublished(true);
    startTransition(async () => {
      const result = await publishClubAction(clubId);
      if (!result.ok) {
        const message =
          "message" in result ? result.message : "クラブの公開に失敗しました。";
        setError(message);
        setOptimisticPublished(false);
        return;
      }
      router.refresh();
    });
  }

  if (optimisticPublished) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-500"
      >
        公開済み
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "公開中…" : "公開する"}
      </button>
      {error && (
        <p
          role="alert"
          className="max-w-xs rounded-md bg-red-50 p-2 text-xs whitespace-pre-line text-red-800"
        >
          {error}
        </p>
      )}
    </div>
  );
}
