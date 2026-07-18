import type { ReactNode } from "react";

type DataFactState = "candidate" | "default" | "verified";

interface DataFactProps {
  detail: ReactNode;
  label: string;
  state?: DataFactState;
  value: ReactNode;
}

export function DataFact({ detail, label, state = "default", value }: DataFactProps) {
  return (
    <div className={`lf-data-fact lf-data-fact--${state}`}>
      <dt>{label}</dt>
      <dd className="lf-data-fact__value">{value}</dd>
      <dd className="lf-data-fact__detail">{detail}</dd>
    </div>
  );
}
