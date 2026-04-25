"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// クラブ一覧の絞り込み用に作った、月単位の複数日選択カレンダー。
// 外部 props は「選択中の YYYY-MM-DD 配列」と「変更時のコールバック」のみ。
// 永続化（URL 反映）は呼び出し側で行う。
//
// 設計メモ:
//   - ライブラリは追加せず、軽量な実装に留める（日付計算は date-fns で十分）。
//   - 日跨ぎや月跨ぎは「JST の 0 時」基準で揃える（ADR-0010）。
//   - キーボード操作は最低限（Tab で日ボタンに到達 / Enter / Space で選択）。

interface Props {
  readonly value: ReadonlyArray<string>; // YYYY-MM-DD
  readonly onChange: (next: ReadonlyArray<string>) => void;
  readonly disabled?: boolean;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function ymd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function DateMultiPicker({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const popupRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // 外側クリック / Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = useMemo(() => new Set(value), [value]);

  const days = useMemo(() => {
    const first = startOfMonth(year, month);
    const total = daysInMonth(year, month);
    const leadingBlanks = first.getDay(); // 日曜=0
    const cells: Array<{ kind: "blank" } | { kind: "day"; date: Date }> = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push({ kind: "blank" });
    for (let d = 1; d <= total; d++) {
      cells.push({ kind: "day", date: new Date(year, month, d) });
    }
    return cells;
  }, [year, month]);

  const todayYmd = ymd(today);

  function toggle(date: Date) {
    const key = ymd(date);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next].sort());
  }

  function clear() {
    onChange([]);
  }

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  const buttonLabel =
    value.length === 0
      ? "すべての日付"
      : value.length === 1
        ? formatYmdLabel(value[0])
        : `${formatYmdLabel(value[0])} ほか ${value.length - 1} 日`;

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60"
      >
        {buttonLabel}
        <span aria-hidden="true" className="ml-1 text-[var(--color-muted)]">
          ▾
        </span>
      </button>
      {open && (
        <div
          ref={popupRef}
          role="dialog"
          aria-label="日付を選択"
          className="absolute top-full left-0 z-20 mt-1 w-[calc(100vw-2rem)] max-w-xs rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)] sm:w-72"
        >
          <header className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="前の月"
              className="rounded-lg px-2 py-1 text-sm hover:bg-[var(--color-surface-hover)]"
            >
              ‹
            </button>
            <span className="text-sm font-medium">
              {year} 年 {month + 1} 月
            </span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="次の月"
              className="rounded-lg px-2 py-1 text-sm hover:bg-[var(--color-surface-hover)]"
            >
              ›
            </button>
          </header>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-[var(--color-muted)]">
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                className={
                  i === 0 || i === 6 ? "text-[var(--color-accent)]" : ""
                }
              >
                {w}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {days.map((cell, idx) => {
              if (cell.kind === "blank") {
                return <span key={`blank-${idx}`} aria-hidden="true" />;
              }
              const key = ymd(cell.date);
              const isSelected = selected.has(key);
              const isToday = key === todayYmd;
              const dayOfWeek = cell.date.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(cell.date)}
                  aria-pressed={isSelected}
                  aria-label={`${year}年${month + 1}月${cell.date.getDate()}日`}
                  className={[
                    "flex h-9 items-center justify-center rounded-lg text-sm",
                    isSelected
                      ? "bg-[var(--color-primary)] font-semibold text-white"
                      : isToday
                        ? "border border-[var(--color-primary)] text-[var(--color-foreground)]"
                        : "text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]",
                    !isSelected && isWeekend
                      ? "text-[var(--color-accent)]"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
          <footer className="mt-3 flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={clear}
              className="rounded-lg px-2 py-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)] disabled:opacity-60"
              disabled={value.length === 0}
            >
              選択をクリア
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-hover)]"
            >
              閉じる
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}

function formatYmdLabel(ymdValue: string): string {
  const [, m, d] = ymdValue.split("-");
  return `${Number(m)}月${Number(d)}日`;
}
