"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  Button,
  Field,
  FormMessage,
  Input,
  fieldAriaProps,
} from "@/components/ui";

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

const CODE_HINT_CREATE =
  "予約番号の先頭に付く識別子です。例: 「ozu」にすると予約番号は「ozu_123456」のように発行されます。\n小文字アルファベットで始まり、英数字 2〜10 文字で入力してください。作成後は変更できません。";
const CODE_HINT_EDIT = "予約番号との整合のため、登録後は変更できません。";

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
        <FormMessage tone="danger" messageRef={errorRef} tabIndex={-1}>
          {formError}
        </FormMessage>
      )}

      <Field
        id="facility-code"
        label="prefix（予約番号の識別子）"
        hint={mode === "create" ? CODE_HINT_CREATE : CODE_HINT_EDIT}
        error={fieldErrors.code}
        required={mode === "create"}
      >
        <Input
          id="facility-code"
          name="code"
          type="text"
          required={mode === "create"}
          maxLength={10}
          value={values.code}
          onChange={(e) =>
            update("code", e.target.value.toLowerCase().replace(/\s+/g, ""))
          }
          disabled={mode === "edit"}
          readOnly={mode === "edit"}
          invalid={Boolean(fieldErrors.code)}
          {...fieldAriaProps({
            id: "facility-code",
            error: fieldErrors.code,
            hint: CODE_HINT_CREATE,
            required: mode === "create",
          })}
        />
      </Field>

      <Field id="facility-name" label="館名" error={fieldErrors.name} required>
        <Input
          id="facility-name"
          name="name"
          type="text"
          required
          maxLength={100}
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          invalid={Boolean(fieldErrors.name)}
          {...fieldAriaProps({
            id: "facility-name",
            error: fieldErrors.name,
            required: true,
          })}
        />
      </Field>

      <Field
        id="facility-phone"
        label="電話番号（お問い合わせ先）"
        hint="利用者向けメールの問い合わせ先として表示されます。"
        error={fieldErrors.phone}
        required
      >
        <Input
          id="facility-phone"
          name="phone"
          type="tel"
          required
          maxLength={20}
          value={values.phone}
          onChange={(e) => update("phone", e.target.value)}
          invalid={Boolean(fieldErrors.phone)}
          {...fieldAriaProps({
            id: "facility-phone",
            error: fieldErrors.phone,
            hint: "利用者向けメールの問い合わせ先として表示されます。",
            required: true,
          })}
        />
      </Field>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending} fullWidth>
          {pending
            ? "保存中…"
            : mode === "create"
              ? "登録する"
              : "変更を保存する"}
        </Button>
      </div>
    </form>
  );
}
