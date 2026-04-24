"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, FormMessage } from "@/components/ui";

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
