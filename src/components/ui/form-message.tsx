import type { ReactNode, Ref } from "react";

// フォーム上部 / 画面上部に出すお知らせ / 警告のバナー。
// tone で色を切り替え、role も tone に応じて出し分ける。

type Tone = "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  info:
    "bg-[var(--color-info-soft,theme(colors.sky.50))] " +
    "text-[var(--color-info,theme(colors.sky.900))]",
  success:
    "bg-[var(--color-success-soft,theme(colors.emerald.50))] " +
    "text-[var(--color-success,theme(colors.emerald.800))]",
  warning:
    "bg-[var(--color-warning-soft,theme(colors.amber.50))] " +
    "text-[var(--color-warning,theme(colors.amber.900))]",
  danger:
    "bg-[var(--color-danger-soft,theme(colors.red.50))] " +
    "text-[var(--color-danger,theme(colors.red.800))]",
};

const TONE_ROLE: Record<Tone, "status" | "alert"> = {
  info: "status",
  success: "status",
  warning: "alert",
  danger: "alert",
};

interface FormMessageProps {
  readonly tone?: Tone;
  readonly children: ReactNode;
  readonly className?: string;
  readonly tabIndex?: number;
  readonly messageRef?: Ref<HTMLParagraphElement>;
}

export function FormMessage({
  tone = "info",
  children,
  className = "",
  tabIndex,
  messageRef,
}: FormMessageProps) {
  return (
    <p
      ref={messageRef}
      role={TONE_ROLE[tone]}
      tabIndex={tabIndex}
      className={
        "rounded-xl p-3 text-sm whitespace-pre-line " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 " +
        `focus-visible:outline-[var(--color-${tone},theme(colors.red.500))] ` +
        `${TONE_CLASS[tone]} ${className}`.trim()
      }
    >
      {children}
    </p>
  );
}
