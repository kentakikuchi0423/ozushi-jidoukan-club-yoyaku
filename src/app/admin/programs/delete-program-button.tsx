"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteProgramAction } from "./actions";

interface Props {
  readonly programId: string;
  readonly programName: string;
  readonly referencedClubCount: number;
}

export function DeleteProgramButton({
  programId,
  programName,
  referencedClubCount,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const detail =
      referencedClubCount > 0
        ? `「${programName}」を削除します。\n現在 ${referencedClubCount} 件のクラブが参照しています。\n削除後はフォームの選択肢から消えますが、既存クラブの表示には影響しません。\nよろしいですか？`
        : `「${programName}」を削除します。\nこの操作は取り消せません。\nよろしいですか？`;
    if (!window.confirm(detail)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProgramAction(programId);
      if (!result.ok) {
        // 削除系の server action は kind: "input" を返す経路が無いが、型上あり得るので
        // ガードしつつ、未知ケースは汎用メッセージを表示する。
        const message =
          "message" in result
            ? result.message
            : "クラブ・事業の削除に失敗しました。";
        setError(message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "削除中…" : "削除"}
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
