"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteFacilityAction } from "./actions";

interface Props {
  readonly facilityId: number;
  readonly facilityName: string;
}

export function DeleteFacilityButton({ facilityId, facilityName }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const detail = `「${facilityName}」を削除します。\n削除後もこの館に紐づく既存のクラブ・予約情報は残ります。\nただし新しいクラブの登録や利用者画面への表示はできなくなります。\nよろしいですか？`;
    if (!window.confirm(detail)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteFacilityAction(facilityId);
      if (!result.ok) {
        const message =
          "message" in result ? result.message : "館の削除に失敗しました。";
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
