"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import type { FacilityActionResult } from "./actions";

export interface FacilityFormValues {
  code: string;
  name: string;
  phone: string;
}

interface Props {
  mode: "create" | "edit";
  initial: FacilityFormValues;
  submitAction: (input: FacilityFormValues) => Promise<FacilityActionResult>;
}

export function FacilityForm({ mode, initial, submitAction }: Props) {
  const [values, setValues] = useState<FacilityFormValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    document.documentElement.dataset.facilityFormReady = "true";
    return () => {
      delete document.documentElement.dataset.facilityFormReady;
    };
  }, []);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  function update<K extends keyof FacilityFormValues>(
    key: K,
    value: FacilityFormValues[K],
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
          htmlFor="facility-code"
          className="block text-sm font-medium text-zinc-700"
        >
          prefix（予約番号の識別子）
        </label>
        <input
          id="facility-code"
          name="code"
          type="text"
          required={mode === "create"}
          aria-required={mode === "create" ? "true" : undefined}
          aria-invalid={fieldErrors.code ? true : undefined}
          aria-describedby={
            fieldErrors.code ? "facility-code-error" : "facility-code-hint"
          }
          maxLength={10}
          value={values.code}
          onChange={(e) =>
            update("code", e.target.value.toLowerCase().replace(/\s+/g, ""))
          }
          disabled={mode === "edit"}
          readOnly={mode === "edit"}
          className={`${inputClass(fieldErrors.code)} ${
            mode === "edit"
              ? "cursor-not-allowed bg-zinc-100 text-zinc-500"
              : ""
          }`}
        />
        {fieldErrors.code ? (
          <p id="facility-code-error" className="text-xs text-red-700">
            {fieldErrors.code}
          </p>
        ) : (
          <p
            id="facility-code-hint"
            className="text-xs whitespace-pre-line text-zinc-500"
          >
            {mode === "create"
              ? "予約番号の先頭に付く識別子です。例: 「ozu」にすると予約番号は「ozu_123456」のように発行されます。\n小文字アルファベットで始まり、英数字 2〜10 文字で入力してください。作成後は変更できません。"
              : "予約番号との整合のため、登録後は変更できません。"}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="facility-name"
          className="block text-sm font-medium text-zinc-700"
        >
          館名
        </label>
        <input
          id="facility-name"
          name="name"
          type="text"
          required
          aria-required="true"
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={
            fieldErrors.name ? "facility-name-error" : undefined
          }
          maxLength={100}
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className={inputClass(fieldErrors.name)}
        />
        {fieldErrors.name && (
          <p id="facility-name-error" className="text-xs text-red-700">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="facility-phone"
          className="block text-sm font-medium text-zinc-700"
        >
          電話番号（お問い合わせ先）
        </label>
        <input
          id="facility-phone"
          name="phone"
          type="tel"
          required
          aria-required="true"
          aria-invalid={fieldErrors.phone ? true : undefined}
          aria-describedby={
            fieldErrors.phone ? "facility-phone-error" : "facility-phone-hint"
          }
          maxLength={20}
          value={values.phone}
          onChange={(e) => update("phone", e.target.value)}
          className={inputClass(fieldErrors.phone)}
        />
        {fieldErrors.phone ? (
          <p id="facility-phone-error" className="text-xs text-red-700">
            {fieldErrors.phone}
          </p>
        ) : (
          <p id="facility-phone-hint" className="text-xs text-zinc-500">
            利用者向けメールの問い合わせ先として表示されます。
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
