"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { FACILITY_NAMES, type FacilityCode } from "@/lib/facility";
import type { ClubActionResult } from "./actions";

export interface ClubFormValues {
  facilityCode: FacilityCode;
  name: string;
  startAt: string; // datetime-local
  endAt: string;
  capacity: number;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  photoUrl: string;
  description: string;
}

interface Props {
  mode: "create" | "edit";
  availableFacilities: readonly FacilityCode[];
  initial: ClubFormValues;
  submitAction: (input: ClubFormValues) => Promise<ClubActionResult>;
  deleteAction?: () => Promise<ClubActionResult>;
}

const LABELS = {
  facilityCode: "館",
  name: "クラブ名",
  startAt: "開始日時",
  endAt: "終了日時",
  capacity: "定員",
  targetAgeMin: "対象年齢（最小）",
  targetAgeMax: "対象年齢（最大）",
  photoUrl: "写真 URL",
  description: "説明",
} as const;

export function ClubForm({
  mode,
  availableFacilities,
  initial,
  submitAction,
  deleteAction,
}: Props) {
  const [values, setValues] = useState<ClubFormValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDeletion] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    document.documentElement.dataset.clubFormReady = "true";
    return () => {
      delete document.documentElement.dataset.clubFormReady;
    };
  }, []);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  function update<K extends keyof ClubFormValues>(
    key: K,
    value: ClubFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await submitAction(values);
      if (!result.ok) handleFailure(result);
      // ok の場合は action 内で redirect される
    });
  }

  function handleDelete() {
    if (!deleteAction) return;
    if (
      !window.confirm(
        "このクラブを削除します。\n削除後は利用者画面から見えなくなります。\nよろしいですか？",
      )
    )
      return;
    setFieldErrors({});
    setFormError(null);
    startDeletion(async () => {
      const result = await deleteAction();
      if (!result.ok) handleFailure(result);
    });
  }

  function handleFailure(result: ClubActionResult & { ok: false }) {
    if (result.kind === "input") {
      setFieldErrors(result.fieldErrors);
      setFormError("入力内容を確認してください。");
      return;
    }
    setFormError(result.message);
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

      <FieldGroup
        id="facilityCode"
        label={LABELS.facilityCode}
        error={fieldErrors.facilityCode}
      >
        <select
          id="facilityCode"
          name="facilityCode"
          value={values.facilityCode}
          onChange={(e) =>
            update("facilityCode", e.target.value as FacilityCode)
          }
          {...fieldAriaProps("facilityCode", fieldErrors.facilityCode)}
          className={selectClass(fieldErrors.facilityCode)}
        >
          {availableFacilities.map((code) => (
            <option key={code} value={code}>
              {FACILITY_NAMES[code]}
            </option>
          ))}
        </select>
      </FieldGroup>

      <FieldGroup id="name" label={LABELS.name} error={fieldErrors.name}>
        <input
          id="name"
          name="name"
          type="text"
          value={values.name}
          maxLength={100}
          onChange={(e) => update("name", e.target.value)}
          {...fieldAriaProps("name", fieldErrors.name)}
          className={inputClass(fieldErrors.name)}
        />
      </FieldGroup>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup
          id="startAt"
          label={LABELS.startAt}
          error={fieldErrors.startAt}
        >
          <input
            id="startAt"
            name="startAt"
            type="datetime-local"
            step={1800}
            value={values.startAt}
            onChange={(e) => update("startAt", e.target.value)}
            {...fieldAriaProps("startAt", fieldErrors.startAt)}
            className={inputClass(fieldErrors.startAt)}
          />
        </FieldGroup>
        <FieldGroup id="endAt" label={LABELS.endAt} error={fieldErrors.endAt}>
          <input
            id="endAt"
            name="endAt"
            type="datetime-local"
            step={1800}
            value={values.endAt}
            onChange={(e) => update("endAt", e.target.value)}
            {...fieldAriaProps("endAt", fieldErrors.endAt)}
            className={inputClass(fieldErrors.endAt)}
          />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldGroup
          id="capacity"
          label={LABELS.capacity}
          error={fieldErrors.capacity}
        >
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={1000}
            value={values.capacity}
            onChange={(e) =>
              update("capacity", Number.parseInt(e.target.value, 10))
            }
            {...fieldAriaProps("capacity", fieldErrors.capacity)}
            className={inputClass(fieldErrors.capacity)}
          />
        </FieldGroup>
        <FieldGroup
          id="targetAgeMin"
          label={LABELS.targetAgeMin}
          hint="空欄で指定なし"
          error={fieldErrors.targetAgeMin}
        >
          <input
            id="targetAgeMin"
            name="targetAgeMin"
            type="number"
            min={0}
            max={120}
            value={values.targetAgeMin ?? ""}
            onChange={(e) =>
              update(
                "targetAgeMin",
                e.target.value === ""
                  ? null
                  : Number.parseInt(e.target.value, 10),
              )
            }
            {...fieldAriaProps("targetAgeMin", fieldErrors.targetAgeMin, true)}
            className={inputClass(fieldErrors.targetAgeMin)}
          />
        </FieldGroup>
        <FieldGroup
          id="targetAgeMax"
          label={LABELS.targetAgeMax}
          hint="空欄で指定なし"
          error={fieldErrors.targetAgeMax}
        >
          <input
            id="targetAgeMax"
            name="targetAgeMax"
            type="number"
            min={0}
            max={120}
            value={values.targetAgeMax ?? ""}
            onChange={(e) =>
              update(
                "targetAgeMax",
                e.target.value === ""
                  ? null
                  : Number.parseInt(e.target.value, 10),
              )
            }
            {...fieldAriaProps("targetAgeMax", fieldErrors.targetAgeMax, true)}
            className={inputClass(fieldErrors.targetAgeMax)}
          />
        </FieldGroup>
      </div>

      <FieldGroup
        id="photoUrl"
        label={LABELS.photoUrl}
        hint="http:// または https:// で始まる URL。空欄可"
        error={fieldErrors.photoUrl}
      >
        <input
          id="photoUrl"
          name="photoUrl"
          type="url"
          inputMode="url"
          value={values.photoUrl}
          onChange={(e) => update("photoUrl", e.target.value)}
          {...fieldAriaProps("photoUrl", fieldErrors.photoUrl, true)}
          className={inputClass(fieldErrors.photoUrl)}
        />
      </FieldGroup>

      <FieldGroup
        id="description"
        label={LABELS.description}
        hint="2000 字以内。\n改行は本文でそのまま反映されます。"
        error={fieldErrors.description}
      >
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={2000}
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          {...fieldAriaProps("description", fieldErrors.description, true)}
          className={inputClass(fieldErrors.description)}
        />
      </FieldGroup>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {deleteAction ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending || deleting}
            className="w-full rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 sm:w-auto"
          >
            {deleting ? "削除中…" : "このクラブを削除する"}
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending || deleting}
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
        >
          {pending
            ? mode === "create"
              ? "登録中…"
              : "更新中…"
            : mode === "create"
              ? "登録する"
              : "変更を保存する"}
        </button>
      </div>
    </form>
  );
}

function FieldGroup({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className="text-xs whitespace-pre-line text-zinc-500"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function fieldAriaProps(id: string, error?: string, hasHint = false) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error
      ? `${id}-error`
      : hasHint
        ? `${id}-hint`
        : undefined,
  };
}

function inputClass(error?: string): string {
  return `w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 ${
    error
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-300 focus:border-zinc-500"
  }`;
}

function selectClass(error?: string): string {
  return inputClass(error);
}
