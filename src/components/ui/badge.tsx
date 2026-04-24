import type { ReactNode } from "react";

// カードの右上などに置く小さなラベル。トーンで色を切り替える。
// CSS 変数を使うので、テーマ側で色を上書きしやすい。

type Tone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

const TONE_CLASS: Record<Tone, string> = {
  neutral:
    "bg-[var(--color-surface-muted,theme(colors.zinc.100))] " +
    "text-[var(--color-foreground,theme(colors.zinc.800))]",
  primary:
    "bg-[var(--color-primary-soft,theme(colors.emerald.50))] " +
    "text-[var(--color-primary,theme(colors.emerald.800))]",
  success:
    "bg-[var(--color-success-soft,theme(colors.emerald.50))] " +
    "text-[var(--color-success,theme(colors.emerald.800))]",
  warning:
    "bg-[var(--color-warning-soft,theme(colors.amber.50))] " +
    "text-[var(--color-warning,theme(colors.amber.900))]",
  danger:
    "bg-[var(--color-danger-soft,theme(colors.red.50))] " +
    "text-[var(--color-danger,theme(colors.red.800))]",
  info:
    "bg-[var(--color-info-soft,theme(colors.sky.50))] " +
    "text-[var(--color-info,theme(colors.sky.800))]",
  muted:
    "bg-[var(--color-surface-muted,theme(colors.zinc.50))] " +
    "text-[var(--color-muted,theme(colors.zinc.500))]",
};

interface BadgeProps {
  readonly tone?: Tone;
  readonly children: ReactNode;
  readonly className?: string;
}

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
