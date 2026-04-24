import type { ButtonHTMLAttributes, ReactNode } from "react";

// プロジェクト全体で使う基本ボタン。variant / size で見た目を切り替える。
// CSS 変数（--color-*）を介して配色を決めるので、テーマ側の調整だけで
// 全体のトーンを変えられる。複雑な状態を持たせたいときは `cn` のような
// ユーティリティを挟まず、直接 className を追加できるよう pass-through。

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "focus-visible:ring-[var(--color-focus,theme(colors.zinc.500))]";

const SIZE_CLASS: Record<Size, string> = {
  md: "px-4 py-2.5 text-sm",
  sm: "px-3 py-1.5 text-xs",
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "bg-[var(--color-primary,theme(colors.zinc.900))] text-white " +
    "hover:bg-[var(--color-primary-hover,theme(colors.zinc.800))]",
  secondary:
    "border border-[var(--color-border,theme(colors.zinc.300))] " +
    "bg-[var(--color-surface,white)] text-[var(--color-foreground,theme(colors.zinc.700))] " +
    "hover:bg-[var(--color-surface-hover,theme(colors.zinc.50))]",
  danger:
    "border border-[var(--color-danger-border,theme(colors.red.300))] " +
    "bg-white text-[var(--color-danger,theme(colors.red.700))] " +
    "hover:bg-[var(--color-danger-soft,theme(colors.red.50))]",
  ghost:
    "text-[var(--color-muted,theme(colors.zinc.600))] underline " +
    "underline-offset-4 hover:text-[var(--color-foreground,theme(colors.zinc.900))]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  readonly size?: Size;
  readonly fullWidth?: boolean;
  readonly children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const width = fullWidth ? "w-full sm:w-auto" : "";
  return (
    <button
      type={type}
      className={`${BASE} ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${width} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
