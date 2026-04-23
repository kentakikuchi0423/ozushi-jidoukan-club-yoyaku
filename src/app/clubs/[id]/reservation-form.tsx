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

interface DraftValues {
  parentName: string;
  parentKana: string;
  childName: string;
  childKana: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY: DraftValues = {
  parentName: "",
  parentKana: "",
  childName: "",
  childKana: "",
  phone: "",
  email: "",
  notes: "",
};

const FIELD_LABELS: Record<keyof DraftValues, string> = {
  parentName: "保護者の名前",
  parentKana: "保護者の名前（ひらがな）",
  childName: "お子さまの名前",
  childKana: "お子さまの名前（ひらがな）",
  phone: "電話番号",
  email: "メールアドレス",
  notes: "備考（任意）",
};

export function ReservationForm({ clubId }: { clubId: string }) {
  const [stage, setStage] = useState<Stage>("draft");
  const [values, setValues] = useState<DraftValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // E2E でハイドレーション完了を検知するためのマーカー。
  // useEffect は hydrate 完了後にのみ実行されるので、data 属性が付いていれば
  // React のイベントハンドラも wire up 済みとみなせる。
  useEffect(() => {
    document.documentElement.dataset.reservationFormReady = "true";
    return () => {
      delete document.documentElement.dataset.reservationFormReady;
    };
  }, []);

  function updateField<K extends keyof DraftValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validateLocally(): ReservationInput | null {
    // Client 側は UX 用の軽い検証のみ（server action 側で再検証する）
    const input = {
      parentName: values.parentName,
      parentKana: values.parentKana,
      childName: values.childName,
      childKana: values.childKana,
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
    if (!result) return; // redirect 成功時は到達しない
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
      {/* スクリーンリーダー向けのステージ遷移アナウンス。aria-live で読み上げる */}
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
          onChange={updateField}
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
  onChange: <K extends keyof DraftValues>(key: K, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function DraftStep({
  values,
  fieldErrors,
  formError,
  onChange,
  onSubmit,
}: DraftStepProps) {
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

      <Field
        id="parentName"
        label={FIELD_LABELS.parentName}
        value={values.parentName}
        error={fieldErrors.parentName}
        onChange={(v) => onChange("parentName", v)}
        autoComplete="name"
        required
      />
      <Field
        id="parentKana"
        label={FIELD_LABELS.parentKana}
        value={values.parentKana}
        error={fieldErrors.parentKana}
        onChange={(v) => onChange("parentKana", v)}
        hint="ひらがなで入力してください"
        required
      />
      <Field
        id="childName"
        label={FIELD_LABELS.childName}
        value={values.childName}
        error={fieldErrors.childName}
        onChange={(v) => onChange("childName", v)}
        required
      />
      <Field
        id="childKana"
        label={FIELD_LABELS.childKana}
        value={values.childKana}
        error={fieldErrors.childKana}
        onChange={(v) => onChange("childKana", v)}
        hint="ひらがなで入力してください"
        required
      />
      <Field
        id="phone"
        label={FIELD_LABELS.phone}
        type="tel"
        value={values.phone}
        error={fieldErrors.phone}
        onChange={(v) => onChange("phone", v)}
        autoComplete="tel"
        hint="半角数字（ハイフンあり/なし）"
        required
      />
      <Field
        id="email"
        label={FIELD_LABELS.email}
        type="email"
        value={values.email}
        error={fieldErrors.email}
        onChange={(v) => onChange("email", v)}
        autoComplete="email"
        hint="確認メール送信先になります"
        required
      />

      <div className="space-y-1">
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-zinc-700"
        >
          {FIELD_LABELS.notes}
        </label>
        <textarea
          id="notes"
          name="notes"
          value={values.notes}
          onChange={(e) => onChange("notes", e.target.value)}
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

      <button
        type="submit"
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
      >
        内容を確認する
      </button>
    </form>
  );
}

interface FieldProps {
  id: keyof DraftValues;
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
        className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 ${
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

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-md bg-zinc-50 p-4 text-sm">
        <Entry label={FIELD_LABELS.parentName} value={values.parentName} />
        <Entry label={FIELD_LABELS.parentKana} value={values.parentKana} />
        <Entry label={FIELD_LABELS.childName} value={values.childName} />
        <Entry label={FIELD_LABELS.childKana} value={values.childKana} />
        <Entry label={FIELD_LABELS.phone} value={values.phone} />
        <Entry label={FIELD_LABELS.email} value={values.email} />
        {values.notes && (
          <Entry label={FIELD_LABELS.notes} value={values.notes} />
        )}
      </dl>

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

function Entry({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </>
  );
}
