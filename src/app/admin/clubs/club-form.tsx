"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { ClubProgram } from "@/lib/clubs/types";
import type { FacilityCode } from "@/lib/facility";
import type { ClubActionResult } from "./actions";

export interface AvailableFacility {
  readonly code: FacilityCode;
  readonly name: string;
}

export interface ClubFormValues {
  facilityCode: FacilityCode;
  programId: string;
  startAt: string; // datetime-local
  endAt: string;
  // ユーザがフィールドを一瞬空にするケースがあるため null 許容にしている。
  // null のまま保存ボタンを押すと server action の zod が弾いて日本語エラーを返す。
  capacity: number | null;
  photoUrl: string;
  description: string;
}

interface Props {
  mode: "create" | "edit";
  availableFacilities: ReadonlyArray<AvailableFacility>;
  /** ドロップダウンで選択可能なマスター一覧（soft delete 済みは除外済み）。 */
  availablePrograms: ReadonlyArray<ClubProgram>;
  /**
   * edit モードで「元々の program が soft delete 済み」のケース用。
   * availablePrograms に含まれなくても編集時だけ表示に使う。
   */
  currentProgram?: ClubProgram | null;
  initial: ClubFormValues;
  submitAction: (input: ClubFormValues) => Promise<ClubActionResult>;
  deleteAction?: () => Promise<ClubActionResult>;
}

const LABELS = {
  facilityCode: "館",
  programId: "クラブ・事業",
  eventDate: "開催日",
  startTime: "開始時刻",
  endTime: "終了時刻",
  capacity: "定員",
  photoUrl: "写真 URL",
  description: "説明",
} as const;

/** `YYYY-MM-DDTHH:MM` を `{date, time}` に分解する。datetime-local 前提。 */
function splitDatetimeLocal(dt: string): { date: string; time: string } {
  if (!dt) return { date: "", time: "" };
  const [date, timeWithMaybeSec = ""] = dt.split("T");
  const time = timeWithMaybeSec.slice(0, 5);
  return { date: date ?? "", time };
}

export function ClubForm({
  mode,
  availableFacilities,
  availablePrograms,
  currentProgram,
  initial,
  submitAction,
  deleteAction,
}: Props) {
  const [values, setValues] = useState<ClubFormValues>(initial);
  // 日時入力は「日付 1 つ + 開始時刻 + 終了時刻」の 3 フィールドに分けて扱う。
  // submit 時に `YYYY-MM-DDTHH:MM` 形式の datetime-local 文字列に戻して
  // ClubFormValues.startAt / endAt に書き込む（server 側の zod スキーマは不変）。
  const initialStart = splitDatetimeLocal(initial.startAt);
  const initialEnd = splitDatetimeLocal(initial.endAt);
  const [eventDate, setEventDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endTime, setEndTime] = useState(initialEnd.time);
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

  // edit 中の program が soft delete 済みなら、ドロップダウンの末尾に 1 件だけ
  // 「（削除済み）」マークで見えるようにする。新規作成時には出さない。
  const programsForDropdown = useMemo<ClubProgram[]>(() => {
    if (!currentProgram) return [...availablePrograms];
    const alreadyInList = availablePrograms.some(
      (p) => p.id === currentProgram.id,
    );
    if (alreadyInList) return [...availablePrograms];
    return [...availablePrograms, currentProgram];
  }, [availablePrograms, currentProgram]);

  const selectedProgram = programsForDropdown.find(
    (p) => p.id === values.programId,
  );
  const showOrphanWarning =
    mode === "edit" && currentProgram !== null && currentProgram !== undefined
      ? !availablePrograms.some((p) => p.id === currentProgram.id)
      : false;

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

    // 日付・時刻のフロント側前処理: 未入力を検出し、OK なら datetime-local に合成する。
    const localErrors: Record<string, string> = {};
    if (!eventDate) localErrors.eventDate = "開催日を入力してください";
    if (!startTime) localErrors.startTime = "開始時刻を入力してください";
    if (!endTime) localErrors.endTime = "終了時刻を入力してください";
    if (
      !localErrors.startTime &&
      !localErrors.endTime &&
      startTime &&
      endTime &&
      endTime <= startTime
    ) {
      // 同日前提なので文字列比較でも十分（"HH:MM" は辞書順で時刻順に一致）
      localErrors.endTime = "終了時刻は開始時刻より後にしてください";
    }
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setFormError("入力内容を確認してください。");
      return;
    }

    const startAt = `${eventDate}T${startTime}`;
    const endAt = `${eventDate}T${endTime}`;
    const payload: ClubFormValues = {
      ...values,
      startAt,
      endAt,
    };
    setValues(payload);

    startTransition(async () => {
      const result = await submitAction(payload);
      if (!result.ok) handleFailure(result);
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
      // server-side の zod は `startAt` / `endAt` 名でエラーを返すので、
      // 3 フィールド UI（eventDate / startTime / endTime）に対応付け直す。
      const mapped: Record<string, string> = {};
      for (const [key, value] of Object.entries(result.fieldErrors)) {
        if (key === "startAt") {
          mapped.startTime = value;
        } else if (key === "endAt") {
          mapped.endTime = value;
        } else {
          mapped[key] = value;
        }
      }
      setFieldErrors(mapped);
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
          className="rounded-xl bg-[var(--color-danger-soft)] p-3 text-sm whitespace-pre-line text-[var(--color-danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-danger)]"
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
          {availableFacilities.map((f) => (
            <option key={f.code} value={f.code}>
              {f.name}
            </option>
          ))}
        </select>
      </FieldGroup>

      <FieldGroup
        id="programId"
        label={LABELS.programId}
        hint={
          programsForDropdown.length === 0
            ? "先に「クラブ・事業の管理」から事業を登録してください。"
            : undefined
        }
        error={fieldErrors.programId}
      >
        <select
          id="programId"
          name="programId"
          value={values.programId}
          onChange={(e) => update("programId", e.target.value)}
          disabled={programsForDropdown.length === 0}
          {...fieldAriaProps("programId", fieldErrors.programId)}
          className={selectClass(fieldErrors.programId)}
        >
          {programsForDropdown.length === 0 && <option value="">未登録</option>}
          {values.programId === "" && programsForDropdown.length > 0 && (
            <option value="">選択してください</option>
          )}
          {programsForDropdown.map((p) => {
            const isDeleted =
              currentProgram?.id === p.id &&
              !availablePrograms.some((x) => x.id === p.id);
            return (
              <option key={p.id} value={p.id}>
                {p.name}
                {isDeleted ? "（削除済み）" : ""}
              </option>
            );
          })}
        </select>
        {showOrphanWarning && (
          <p className="mt-1 text-xs text-[var(--color-warning)]">
            このクラブは削除済みのマスターを参照しています。
            <br />
            有効なクラブ・事業に変更してから保存してください。
          </p>
        )}
        {selectedProgram && (
          <div className="mt-2 space-y-1 rounded-xl bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-foreground)]/80">
            <p>
              <span className="font-medium text-[var(--color-muted)]">
                対象年齢:{" "}
              </span>
              {selectedProgram.targetAge}
            </p>
            <p>
              <span className="font-medium text-[var(--color-muted)]">
                概要:{" "}
              </span>
              <span className="whitespace-pre-wrap">
                {selectedProgram.summary}
              </span>
            </p>
          </div>
        )}
      </FieldGroup>

      <FieldGroup
        id="eventDate"
        label={LABELS.eventDate}
        error={fieldErrors.eventDate}
      >
        <input
          id="eventDate"
          name="eventDate"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          {...fieldAriaProps("eventDate", fieldErrors.eventDate)}
          className={inputClass(fieldErrors.eventDate)}
        />
      </FieldGroup>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup
          id="startTime"
          label={LABELS.startTime}
          error={fieldErrors.startTime}
        >
          <input
            id="startTime"
            name="startTime"
            type="time"
            step={600}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            {...fieldAriaProps("startTime", fieldErrors.startTime)}
            className={inputClass(fieldErrors.startTime)}
          />
        </FieldGroup>
        <FieldGroup
          id="endTime"
          label={LABELS.endTime}
          error={fieldErrors.endTime}
        >
          <input
            id="endTime"
            name="endTime"
            type="time"
            step={600}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            {...fieldAriaProps("endTime", fieldErrors.endTime)}
            className={inputClass(fieldErrors.endTime)}
          />
        </FieldGroup>
      </div>

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
          value={values.capacity ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              update("capacity", null);
              return;
            }
            const n = Number.parseInt(raw, 10);
            update("capacity", Number.isNaN(n) ? null : n);
          }}
          {...fieldAriaProps("capacity", fieldErrors.capacity)}
          className={inputClass(fieldErrors.capacity)}
        />
      </FieldGroup>

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
        hint={
          "その回固有の補足（空欄可、2000 字以内）。\n改行は本文でそのまま反映されます。"
        }
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
            className="w-full rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {deleting ? "削除中…" : "このクラブを削除する"}
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending || deleting}
          className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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

function FieldGroup({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--color-foreground)]"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : hint ? (
        <p
          id={hintId}
          className="text-xs whitespace-pre-line text-[var(--color-muted)]"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function fieldAriaProps(id: string, error?: string, optional?: boolean) {
  const ariaProps: {
    "aria-invalid"?: true;
    "aria-describedby"?: string;
    "aria-required"?: "true";
  } = {};
  if (error) {
    ariaProps["aria-invalid"] = true;
    ariaProps["aria-describedby"] = `${id}-error`;
  } else {
    ariaProps["aria-describedby"] = `${id}-hint`;
  }
  if (!optional) {
    ariaProps["aria-required"] = "true";
  }
  return ariaProps;
}

function inputClass(error?: string): string {
  return `w-full rounded-xl border px-3 py-2 text-sm shadow-sm bg-[var(--color-surface)] text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
    error
      ? "border-[var(--color-danger-border)] focus-visible:ring-[var(--color-danger)]"
      : "border-[var(--color-border)] focus-visible:ring-[var(--color-focus)]"
  }`;
}

function selectClass(error?: string): string {
  return `w-full rounded-xl border bg-[var(--color-surface)] px-3 py-2 text-sm shadow-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
    error
      ? "border-[var(--color-danger-border)] focus-visible:ring-[var(--color-danger)]"
      : "border-[var(--color-border)] focus-visible:ring-[var(--color-focus)]"
  }`;
}
