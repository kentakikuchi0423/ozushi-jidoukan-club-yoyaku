import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// フォーム入力の見た目を共通化するラッパー。
// error 状態での枠色と focus リングだけ差し替えれば、あとはテーマ側の変数で吸収。

const BASE =
  "w-full rounded-xl border px-3 py-2 text-sm shadow-sm " +
  "bg-[var(--color-surface,white)] text-[var(--color-foreground,theme(colors.zinc.800))] " +
  "placeholder:text-[var(--color-muted,theme(colors.zinc.400))] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

const NORMAL =
  "border-[var(--color-border,theme(colors.zinc.300))] " +
  "focus-visible:border-[var(--color-primary,theme(colors.zinc.500))] " +
  "focus-visible:ring-[var(--color-primary,theme(colors.zinc.500))]";

const ERROR =
  "border-[var(--color-danger-border,theme(colors.red.400))] " +
  "focus-visible:border-[var(--color-danger,theme(colors.red.500))] " +
  "focus-visible:ring-[var(--color-danger,theme(colors.red.500))]";

const DISABLED =
  "disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted,theme(colors.zinc.100))] " +
  "disabled:text-[var(--color-muted,theme(colors.zinc.500))]";

function fieldClass(hasError: boolean, extra = "") {
  return `${BASE} ${hasError ? ERROR : NORMAL} ${DISABLED} ${extra}`.trim();
}

// Input --------------------------------------------------------------------
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly invalid?: boolean;
}

export function Input({
  invalid = false,
  className = "",
  ...rest
}: InputProps) {
  return <input className={fieldClass(invalid, className)} {...rest} />;
}

// Textarea -----------------------------------------------------------------
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly invalid?: boolean;
}

export function Textarea({
  invalid = false,
  className = "",
  ...rest
}: TextareaProps) {
  return <textarea className={fieldClass(invalid, className)} {...rest} />;
}

// Select -------------------------------------------------------------------
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly invalid?: boolean;
}

export function Select({
  invalid = false,
  className = "",
  children,
  ...rest
}: SelectProps) {
  return (
    <select className={fieldClass(invalid, className)} {...rest}>
      {children}
    </select>
  );
}
