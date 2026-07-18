import type { ButtonHTMLAttributes, ReactNode } from "react";
import { SpinnerIcon } from "./icons";

type ButtonVariant = "danger" | "ghost" | "primary" | "secondary";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  trailingIcon?: ReactNode;
  variant?: ButtonVariant;
}

export function ActionButton({
  children,
  className = "",
  disabled,
  loading = false,
  trailingIcon,
  type = "button",
  variant = "primary",
  ...props
}: ActionButtonProps) {
  const classes = ["lf-button", `lf-button--${variant}`, className].filter(Boolean).join(" ");

  return (
    <button
      aria-busy={loading || undefined}
      className={classes}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <SpinnerIcon className="lf-button__spinner" /> : null}
      <span>{children}</span>
      {!loading && trailingIcon ? <span className="lf-button__island">{trailingIcon}</span> : null}
    </button>
  );
}
