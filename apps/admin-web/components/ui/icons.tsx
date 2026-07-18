import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  "aria-hidden": true,
  className: "lf-icon",
  fill: "none",
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
} as const;

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M7 17 17 7M8 7h9v9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m5.5 12.5 4 4 9-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 8.5v4.25m0 3.25v.1M10.1 4.5 3.4 17a1.7 1.7 0 0 0 1.5 2.5h14.2a1.7 1.7 0 0 0 1.5-2.5L13.9 4.5a2.15 2.15 0 0 0-3.8 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7.75v4.75l3 1.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4.75 6.5h14.5v11H4.75v-11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M4.75 13.5h3.4l1.2 1.75h5.3l1.2-1.75h3.4" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3.75 19 6.5v5.25c0 4.3-2.8 7.2-7 8.5-4.2-1.3-7-4.2-7-8.5V6.5l7-2.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="m8.75 12 2.15 2.15 4.35-4.35" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20 12a8 8 0 1 1-2.35-5.65" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}
