"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, FormMessage } from "@/components/ui";

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
      <Button
        variant="danger"
        size="sm"
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? "削除中…" : "削除"}
      </Button>
      {error && (
        <FormMessage tone="danger" className="max-w-xs">
          {error}
        </FormMessage>
      )}
    </div>
  );
}
