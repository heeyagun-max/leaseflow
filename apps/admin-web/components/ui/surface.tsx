import type { HTMLAttributes, ReactNode } from "react";

type SurfaceElement = "article" | "aside" | "div" | "section";
type SurfaceVariant = "accent" | "default" | "subtle";

interface GovernanceSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: SurfaceElement;
  children: ReactNode;
  interactive?: boolean;
  variant?: SurfaceVariant;
}

export function GovernanceSurface({
  as: Component = "section",
  children,
  className = "",
  interactive = false,
  variant = "default",
  ...props
}: GovernanceSurfaceProps) {
  const classes = [
    "lf-surface",
    `lf-surface--${variant}`,
    interactive ? "lf-surface--interactive" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <Component className={classes} {...props}>
      <div className="lf-surface__core">{children}</div>
    </Component>
  );
}
