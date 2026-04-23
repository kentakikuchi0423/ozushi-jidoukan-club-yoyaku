"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteAdminAction } from "./actions";

interface Props {
  readonly targetAdminId: string;
  readonly targetLabel: string;
}

export function DeleteAdminButton({ targetAdminId, targetLabel }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        `${targetLabel} を削除します。\nこの操作は取り消せません。\nよろしいですか？`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteAdminAction(targetAdminId);
      if (!result.ok) {
        setError(result.message);
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
