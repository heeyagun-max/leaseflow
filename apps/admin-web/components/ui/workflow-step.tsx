import type { ReactNode } from "react";

type WorkflowStepState = "blocked" | "complete" | "current" | "pending";

interface WorkflowStepProps {
  children: ReactNode;
  index: number;
  state: WorkflowStepState;
  title: string;
}

export function WorkflowStep({ children, index, state, title }: WorkflowStepProps) {
  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      className={`lf-workflow-step lf-workflow-step--${state}`}
    >
      <span className="lf-workflow-step__index" aria-hidden="true">{index}</span>
      <span>
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
    </li>
  );
}
