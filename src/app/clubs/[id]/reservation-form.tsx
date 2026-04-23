"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  reservationInputSchema,
  type ReservationInput,
} from "@/lib/reservations/input-schema";
import {
  createReservationAction,
  type ReservationActionResult,
} from "./actions";

type Stage = "draft" | "preview";

interface Person {
  name: string;
  kana: string;
}

interface DraftValues {
  parents: Person[];
  children: Person[];
  phone: string;
  email: string;
  notes: string;
}

const EMPTY_PERSON: Person = { name: "", kana: "" };
const EMPTY: DraftValues = {
  parents: [{ ...EMPTY_PERSON }],
  children: [{ ...EMPTY_PERSON }],
  phone: "",
  email: "",
  notes: "",
};

const MAX_PEOPLE = 10;

export function ReservationForm({ clubId }: { clubId: string }) {
  const [stage, setStage] = useState<Stage>("draft");
  const [values, setValues] = useState<DraftValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.dataset.reservationFormReady = "true";
    return () => {
      delete document.documentElement.dataset.reservationFormReady;
    };
  }, []);

  function updatePerson(
    kind: "parents" | "children",
    index: number,
    field: keyof Person,
    value: string,
  ) {
    setValues((prev) => {
      const next = prev[kind].map((p, i) =>
        i === index ? { ...p, [field]: value } : p,
      );
      return { ...prev, [kind]: next };
    });
  }

  function addPerson(kind: "parents" | "children") {
    setValues((prev) => {
      if (prev[kind].length >= MAX_PEOPLE) return prev;
      return { ...prev, [kind]: [...prev[kind], { ...EMPTY_PERSON }] };
    });
  }

  function removePerson(kind: "parents" | "children", index: number) {
    setValues((prev) => {
      if (prev[kind].length <= 1) return prev;
      return { ...prev, [kind]: prev[kind].filter((_, i) => i !== index) };
    });
  }

  function updateContact<K extends "phone" | "email" | "notes">(
    key: K,
    value: string,
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validateLocally(): ReservationInput | null {
    const input = {
      parents: values.parents,
      children: values.children,
      phone: values.phone,
      email: values.email,
      notes: values.notes.length > 0 ? values.notes : undefined,
    };
    const parsed = reservationInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map((p) => String(p)).join(".") || "_form";
        if (!(key in next)) next[key] = issue.message;
      }
      setFieldErrors(next);
      setFormError(
        "入力内容を確認してください。\n赤字のフィールドに問題があります。",
      );
      return null;
    }
    setFieldErrors({});
    setFormError(null);
    return parsed.data;
  }

  function handleGoToPreview(e: React.FormEvent) {
    e.preventDefault();
    const ok = validateLocally();
    if (ok) setStage("preview");
  }

  function handleBackToDraft() {
    setStage("draft");
    setFormError(null);
  }

  function handleConfirm() {
    const parsed = validateLocally();
    if (!parsed) return;
    setFormError(null);
    startTransition(async () => {
      const result = await createReservationAction(clubId, parsed);
      handleActionResult(result);
    });
  }

  function handleActionResult(
    result: ReservationActionResult | undefined,
  ): void {
    if (!result) return;
    if (result.kind === "input") {
      setFieldErrors(result.fieldErrors);
      setFormError("入力内容に問題がありました。\n再度ご確認ください。");
      setStage("draft");
      return;
    }
    setFormError(result.message);
    setStage("draft");
  }

  return (
    <>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {stage === "preview"
          ? "入力内容の確認画面に進みました。"
          : "入力画面です。"}
      </div>
      {stage === "preview" ? (
        <PreviewStep
          values={values}
          pending={pending}
          formError={formError}
          onBack={handleBackToDraft}
          onConfirm={handleConfirm}
        />
      ) : (
        <DraftStep
          values={values}
          fieldErrors={fieldErrors}
          formError={formError}
          onChangePerson={updatePerson}
          onAddPerson={addPerson}
          onRemovePerson={removePerson}
          onChangeContact={updateContact}
          onSubmit={handleGoToPreview}
        />
      )}
    </>
  );
}

interface DraftStepProps {
  values: DraftValues;
  fieldErrors: Record<string, string>;
  formError: string | null;
  onChangePerson: (
    kind: "parents" | "children",
    index: number,
    field: keyof Person,
    value: string,
  ) => void;
  onAddPerson: (kind: "parents" | "children") => void;
  onRemovePerson: (kind: "parents" | "children", index: number) => void;
  onChangeContact: <K extends "phone" | "email" | "notes">(
    key: K,
    value: string,
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function DraftStep({
  values,
  fieldErrors,
  formError,
  onChangePerson,
  onAddPerson,
  onRemovePerson,
  onChangeContact,
  onSubmit,
}: DraftStepProps) {
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
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

      <PeopleSection
        kind="parents"
        legend="保護者"
        values={values.parents}
        fieldErrors={fieldErrors}
        onChange={onChangePerson}
        onAdd={onAddPerson}
        onRemove={onRemovePerson}
      />

      <PeopleSection
        kind="children"
        legend="お子さま"
        values={values.children}
        fieldErrors={fieldErrors}
        onChange={onChangePerson}
        onAdd={onAddPerson}
        onRemove={onRemovePerson}
      />

      <div className="space-y-4 border-t border-zinc-200 pt-6">
        <Field
          id="phone"
          label="電話番号"
          type="tel"
          value={values.phone}
          error={fieldErrors.phone}
          onChange={(v) => onChangeContact("phone", v)}
          autoComplete="tel"
          hint="半角数字（ハイフンあり/なし）"
          required
        />
        <Field
          id="email"
          label="メールアドレス"
          type="email"
          value={values.email}
          error={fieldErrors.email}
          onChange={(v) => onChangeContact("email", v)}
          autoComplete="email"
          hint="確認メール送信先になります"
          required
        />

        <div className="space-y-1">
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-zinc-700"
          >
            備考（任意）
          </label>
          <textarea
            id="notes"
            name="notes"
            value={values.notes}
            onChange={(e) => onChangeContact("notes", e.target.value)}
            rows={3}
            maxLength={500}
            aria-invalid={fieldErrors.notes ? true : undefined}
            aria-describedby={fieldErrors.notes ? "notes-error" : "notes-hint"}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
          />
          {fieldErrors.notes && (
            <p id="notes-error" className="text-xs text-red-700">
              {fieldErrors.notes}
            </p>
          )}
          <p id="notes-hint" className="text-xs text-zinc-500">
            500 字以内
          </p>
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
      >
        内容を確認する
      </button>
    </form>
  );
}

interface PeopleSectionProps {
  kind: "parents" | "children";
  legend: string;
  values: Person[];
  fieldErrors: Record<string, string>;
  onChange: (
    kind: "parents" | "children",
    index: number,
    field: keyof Person,
    value: string,
  ) => void;
  onAdd: (kind: "parents" | "children") => void;
  onRemove: (kind: "parents" | "children", index: number) => void;
}

function PeopleSection({
  kind,
  legend,
  values,
  fieldErrors,
  onChange,
  onAdd,
  onRemove,
}: PeopleSectionProps) {
  const arrayError = fieldErrors[kind];
  const canAdd = values.length < MAX_PEOPLE;
  const canRemove = values.length > 1;
  return (
    <fieldset className="space-y-4 rounded-md border border-zinc-200 p-4">
      <legend className="px-1 text-sm font-semibold text-zinc-700">
        {legend}（1 名以上）
      </legend>

      {arrayError && (
        <p role="alert" className="text-xs text-red-700">
          {arrayError}
        </p>
      )}

      {values.map((person, index) => {
        const nameErr = fieldErrors[`${kind}.${index}.name`];
        const kanaErr = fieldErrors[`${kind}.${index}.kana`];
        return (
          <div
            key={index}
            className="space-y-3 rounded-md bg-zinc-50 p-3 sm:p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-600">
                {legend} {index + 1} 人目
              </p>
              {canRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(kind, index)}
                  className="text-xs text-red-700 underline underline-offset-4 hover:text-red-900"
                  aria-label={`${legend} ${index + 1} 人目を削除`}
                >
                  削除
                </button>
              )}
            </div>
            <Field
              id={`${kind}-${index}-name`}
              label="お名前"
              value={person.name}
              error={nameErr}
              onChange={(v) => onChange(kind, index, "name", v)}
              autoComplete={kind === "parents" && index === 0 ? "name" : "off"}
              required
            />
            <Field
              id={`${kind}-${index}-kana`}
              label="お名前（ひらがな）"
              value={person.kana}
              error={kanaErr}
              onChange={(v) => onChange(kind, index, "kana", v)}
              hint="ひらがなで入力してください"
              required
            />
          </div>
        );
      })}

      {canAdd && (
        <button
          type="button"
          onClick={() => onAdd(kind)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          ＋ {legend}をもう 1 人追加
        </button>
      )}
    </fieldset>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  type?: "text" | "tel" | "email";
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}

function Field({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  autoComplete,
  hint,
  required,
}: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700">
        {label}
        {required && (
          <span className="ml-1 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={required ? true : undefined}
        className={`w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 ${
          error
            ? "border-red-400 focus:border-red-500"
            : "border-zinc-300 focus:border-zinc-500"
        }`}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface PreviewStepProps {
  values: DraftValues;
  pending: boolean;
  formError: string | null;
  onBack: () => void;
  onConfirm: () => void;
}

function PreviewStep({
  values,
  pending,
  formError,
  onBack,
  onConfirm,
}: PreviewStepProps) {
  return (
    <div className="space-y-6">
      {formError && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm whitespace-pre-line text-red-800"
        >
          {formError}
        </p>
      )}

      <section className="rounded-md bg-zinc-50 p-4 text-sm">
        <PeoplePreview legend="保護者" values={values.parents} />
        <hr className="my-3 border-zinc-200" />
        <PeoplePreview legend="お子さま" values={values.children} />
        <hr className="my-3 border-zinc-200" />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-zinc-500">電話番号</dt>
          <dd>{values.phone}</dd>
          <dt className="text-zinc-500">メールアドレス</dt>
          <dd className="break-all">{values.email}</dd>
          {values.notes && (
            <>
              <dt className="text-zinc-500">備考</dt>
              <dd className="whitespace-pre-wrap">{values.notes}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-4 text-sm leading-7 text-zinc-700">
        <h3 className="mb-2 text-sm font-bold">ご予約にあたってのお願い</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            ご予約は先着順です。
            <br />
            受付結果はご登録のメールアドレス宛にお送りします。
          </li>
          <li>
            キャンセルは開催日の 2 営業日前 17 時までに手続きをお願いします。
          </li>
          <li>
            それ以降のキャンセルおよび無断欠席は、他の利用者への影響が大きいため原則ご遠慮ください。
          </li>
          <li>
            キャンセルが続く場合は、今後のご利用をお断りすることがあります。
          </li>
        </ul>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 sm:w-auto"
        >
          入力に戻る
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
        >
          {pending ? "送信中…" : "予約を確定する"}
        </button>
      </div>
    </div>
  );
}

function PeoplePreview({
  legend,
  values,
}: {
  legend: string;
  values: Person[];
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-zinc-500">{legend}</p>
      <ul className="space-y-1">
        {values.map((p, i) => (
          <li key={i}>
            {p.name}（{p.kana}）
          </li>
        ))}
      </ul>
    </div>
  );
}
