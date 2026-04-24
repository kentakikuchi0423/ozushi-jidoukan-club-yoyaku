import type { ElementType, ReactNode } from "react";

// 情報カード。薄い枠と柔らかい影で、リストの各項目や囲み節を表現する。
// `as` で section / article / div を切り替えられる（a11y のために）。

interface CardProps {
  readonly as?: ElementType;
  readonly children: ReactNode;
  readonly className?: string;
}

export function Card({
  as: Tag = "section",
  children,
  className = "",
}: CardProps) {
  return (
    <Tag
      className={
        "rounded-2xl border border-[var(--color-border,theme(colors.zinc.200))] " +
        "bg-[var(--color-surface,white)] shadow-[var(--shadow-soft,0_1px_2px_rgb(0_0_0_/0.05))] " +
        `${className}`.trim()
      }
    >
      {children}
    </Tag>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <div className={`p-4 sm:p-6 ${className}`.trim()}>{children}</div>;
}

export function CardDashed({
  children,
  className = "",
  role,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly role?: string;
}) {
  return (
    <div
      role={role}
      className={
        "rounded-2xl border border-dashed border-[var(--color-border,theme(colors.zinc.300))] " +
        "px-6 py-12 text-center text-sm text-[var(--color-muted,theme(colors.zinc.600))] " +
        `${className}`.trim()
      }
    >
      {children}
    </div>
  );
}
