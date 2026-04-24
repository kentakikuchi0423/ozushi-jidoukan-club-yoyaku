"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteProgramAction } from "./actions";

interface Props {
  readonly programId: string;
  readonly programName: string;
}

export function DeleteProgramButton({ programId, programName }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const detail = `「${programName}」を削除します。\nこの操作は取り消せません。\nよろしいですか？`;
    if (!window.confirm(detail)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProgramAction(programId);
      if (!result.ok) {
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
