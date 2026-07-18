import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, ClockIcon, InboxIcon } from "./icons";

type FeedbackTone = "empty" | "error" | "info" | "loading" | "success";

interface FeedbackPanelProps {
  action?: ReactNode;
  children: ReactNode;
  title: string;
  tone: FeedbackTone;
}

const icons = {
  empty: InboxIcon,
  error: AlertIcon,
  info: ClockIcon,
  loading: ClockIcon,
  success: CheckIcon,
} as const;

export function FeedbackPanel({ action, children, title, tone }: FeedbackPanelProps) {
  const Icon = icons[tone];
  const liveProps = tone === "error"
    ? { role: "alert" as const }
    : tone === "loading" || tone === "success"
      ? { "aria-live": "polite" as const }
      : {};

  return (
    <div className={`lf-feedback lf-feedback--${tone}`} {...liveProps}>
      <span className="lf-feedback__icon"><Icon /></span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
        {action ? <div className="lf-feedback__action">{action}</div> : null}
      </div>
    </div>
  );
}
