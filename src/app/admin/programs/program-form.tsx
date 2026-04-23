"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import type { ProgramActionResult } from "./actions";

export interface ProgramFormValues {
  name: string;
  targetAge: string;
  summary: string;
}

interface Props {
  mode: "create" | "edit";
  initial: ProgramFormValues;
  submitAction: (input: ProgramFormValues) => Promise<ProgramActionResult>;
}

export function ProgramForm({ mode, initial, submitAction }: Props) {
  const [values, setValues] = useState<ProgramFormValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    document.documentElement.dataset.programFormReady = "true";
    return () => {
      delete document.documentElement.dataset.programFormReady;
    };
  }, []);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  function update<K extends keyof ProgramFormValues>(
    key: K,
    value: ProgramFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await submitAction(values);
      if (!result.ok) {
        if (result.kind === "input") {
          setFieldErrors(result.fieldErrors);
          setFormError("入力内容を確認してください。");
        } else {
          setFormError(result.message);
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {formError && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm whitespace-pre-line text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          {formError}
        </p>
      )}

      <div className="space-y-1">
        <label
          htmlFor="program-name"
          className="block text-sm font-medium text-zinc-700"
        >
          クラブ・事業名
        </label>
        <input
          id="program-name"
          name="name"
          type="text"
          required
          aria-required="true"
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? "program-name-error" : undefined}
          maxLength={100}
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className={inputClass(fieldErrors.name)}
        />
        {fieldErrors.name && (
          <p id="program-name-error" className="text-xs text-red-700">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="program-target-age"
          className="block text-sm font-medium text-zinc-700"
        >
          対象年齢
        </label>
        <input
          id="program-target-age"
          name="targetAge"
          type="text"
          required
          aria-required="true"
          aria-invalid={fieldErrors.targetAge ? true : undefined}
          aria-describedby={
            fieldErrors.targetAge
              ? "program-target-age-error"
              : "program-target-age-hint"
          }
          maxLength={100}
          value={values.targetAge}
          onChange={(e) => update("targetAge", e.target.value)}
          className={inputClass(fieldErrors.targetAge)}
        />
        {fieldErrors.targetAge ? (
          <p id="program-target-age-error" className="text-xs text-red-700">
            {fieldErrors.targetAge}
          </p>
        ) : (
          <p id="program-target-age-hint" className="text-xs text-zinc-500">
            例: ０・１歳児の親子、３歳児〜未就学児
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="program-summary"
          className="block text-sm font-medium text-zinc-700"
        >
          概要
        </label>
        <textarea
          id="program-summary"
          name="summary"
          rows={6}
          required
          aria-required="true"
          aria-invalid={fieldErrors.summary ? true : undefined}
          aria-describedby={
            fieldErrors.summary
              ? "program-summary-error"
              : "program-summary-hint"
          }
          maxLength={2000}
          value={values.summary}
          onChange={(e) => update("summary", e.target.value)}
          className={inputClass(fieldErrors.summary)}
        />
        {fieldErrors.summary ? (
          <p id="program-summary-error" className="text-xs text-red-700">
            {fieldErrors.summary}
          </p>
        ) : (
          <p
            id="program-summary-hint"
            className="text-xs whitespace-pre-line text-zinc-500"
          >
            {"2000 字以内。\n改行は本文でそのまま反映されます。"}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
        >
          {pending
            ? "保存中…"
            : mode === "create"
              ? "登録する"
              : "変更を保存する"}
        </button>
      </div>
    </form>
  );
}

function inputClass(error?: string): string {
  return `w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none ${
    error
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-300 focus:border-zinc-500"
  }`;
}
