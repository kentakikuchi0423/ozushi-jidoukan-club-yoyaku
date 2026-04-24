"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  Button,
  Field,
  FormMessage,
  Input,
  Textarea,
  fieldAriaProps,
} from "@/components/ui";

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

const TARGET_AGE_HINT = "例: ０・１歳児の親子、３歳児〜未就学児";
const SUMMARY_HINT = "2000 字以内。";

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
        <FormMessage tone="danger" messageRef={errorRef} tabIndex={-1}>
          {formError}
        </FormMessage>
      )}

      <Field
        id="program-name"
        label="クラブ・事業名"
        error={fieldErrors.name}
        required
      >
        <Input
          id="program-name"
          name="name"
          type="text"
          required
          maxLength={100}
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          invalid={Boolean(fieldErrors.name)}
          {...fieldAriaProps({
            id: "program-name",
            error: fieldErrors.name,
            required: true,
          })}
        />
      </Field>

      <Field
        id="program-target-age"
        label="対象年齢"
        hint={TARGET_AGE_HINT}
        error={fieldErrors.targetAge}
        required
      >
        <Input
          id="program-target-age"
          name="targetAge"
          type="text"
          required
          maxLength={100}
          value={values.targetAge}
          onChange={(e) => update("targetAge", e.target.value)}
          invalid={Boolean(fieldErrors.targetAge)}
          {...fieldAriaProps({
            id: "program-target-age",
            error: fieldErrors.targetAge,
            hint: TARGET_AGE_HINT,
            required: true,
          })}
        />
      </Field>

      <Field
        id="program-summary"
        label="概要"
        hint={SUMMARY_HINT}
        error={fieldErrors.summary}
        required
      >
        <Textarea
          id="program-summary"
          name="summary"
          rows={6}
          required
          maxLength={2000}
          value={values.summary}
          onChange={(e) => update("summary", e.target.value)}
          invalid={Boolean(fieldErrors.summary)}
          {...fieldAriaProps({
            id: "program-summary",
            error: fieldErrors.summary,
            hint: SUMMARY_HINT,
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
