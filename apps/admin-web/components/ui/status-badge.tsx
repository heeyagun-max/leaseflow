import type { HTMLAttributes, ReactNode } from "react";

type StatusTone = "error" | "info" | "neutral" | "success" | "warning";

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: StatusTone;
}

export function StatusBadge({ children, className = "", tone = "neutral", ...props }: StatusBadgeProps) {
  const classes = ["lf-badge", `lf-badge--${tone}`, className].filter(Boolean).join(" ");

  return (
    <span className={classes} {...props}>
      <span className="lf-badge__mark" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
