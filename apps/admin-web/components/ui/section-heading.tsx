import type { ReactNode } from "react";

type HeadingLevel = 1 | 2 | 3;
type HeadingVariant = "compact" | "page" | "section";

interface SectionHeadingProps {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  headingId?: string;
  level?: HeadingLevel;
  title: ReactNode;
  variant?: HeadingVariant;
}

export function SectionHeading({
  action,
  description,
  eyebrow,
  headingId,
  level = 2,
  title,
  variant = "section",
}: SectionHeadingProps) {
  const Heading = `h${level}` as const;

  return (
    <div className={`lf-section-heading lf-section-heading--${variant}`}>
      {eyebrow ? <p className="lf-eyebrow">{eyebrow}</p> : null}
      <div className="lf-section-heading__row">
        <div className="lf-stack lf-stack--tight">
          <Heading id={headingId}>{title}</Heading>
          {description ? <p className="lf-section-heading__description">{description}</p> : null}
        </div>
        {action ? <div className="lf-cluster">{action}</div> : null}
      </div>
    </div>
  );
}
