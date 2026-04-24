import type { ReactNode } from "react";

// フォームのラベル + 入力 + ヒント / エラーを一括で組むラッパ。
// 個別の Input / Select / Textarea コンポーネントの外側で使う想定。
// aria-describedby / aria-invalid は子の入力要素側で FieldDescribedBy() を使って組む。

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly children: ReactNode;
}

export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--color-foreground,theme(colors.zinc.700))]"
      >
        {label}
        {required && (
          <span
            aria-hidden="true"
            className="ml-1 text-[var(--color-accent,theme(colors.red.500))]"
          >
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-[var(--color-danger,theme(colors.red.700))]"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={hintId}
          className="text-xs whitespace-pre-line text-[var(--color-muted,theme(colors.zinc.500))]"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Field に渡した id から、aria-describedby / aria-invalid / aria-required を
 * 子の入力要素に差し込むためのヘルパ。
 */
export function fieldAriaProps(opts: {
  id: string;
  error?: string;
  hint?: string;
  required?: boolean;
}): {
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: "true";
} {
  const out: {
    "aria-invalid"?: true;
    "aria-describedby"?: string;
    "aria-required"?: "true";
  } = {};
  if (opts.error) {
    out["aria-invalid"] = true;
    out["aria-describedby"] = `${opts.id}-error`;
  } else if (opts.hint) {
    out["aria-describedby"] = `${opts.id}-hint`;
  }
  if (opts.required) {
    out["aria-required"] = "true";
  }
  return out;
}
