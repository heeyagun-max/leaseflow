import Link from "next/link";
import { ShieldIcon, StatusBadge } from "@/components/ui";

interface AppNavigationProps {
  current: "governance" | "reports";
}

export function AppNavigation({ current }: AppNavigationProps) {
  return (
    <header className="lf-app-nav">
      <Link className="lf-app-nav__brand" href="/" aria-label="LeaseFlow Data Admin home">
        <span className="lf-app-nav__mark"><ShieldIcon /></span>
        <span>
          <strong>LeaseFlow</strong>
          <span>Governed operations</span>
        </span>
      </Link>
      <nav className="lf-app-nav__links" aria-label="Admin product">
        <Link aria-current={current === "governance" ? "page" : undefined} href="/">
          Data governance
        </Link>
        <Link aria-current={current === "reports" ? "page" : undefined} href="/reports">
          Weekly reports
        </Link>
      </nav>
      <div className="lf-app-nav__status" aria-label="Runtime status">
        <StatusBadge tone="info">Synthetic demo</StatusBadge>
      </div>
    </header>
  );
}
