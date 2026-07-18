import Link from "next/link";
import { StatusBadge } from "@/components/ui";

interface AppNavigationProps {
  current: "governance" | "reports";
}

export function AppNavigation({ current }: AppNavigationProps) {
  return (
    <header className="lf-app-nav">
      <Link className="lf-app-nav__brand" href="/" aria-label="LeaseFlow 자산 운영 홈">
        <span className="lf-app-nav__mark" aria-hidden="true"><span className="lf-app-nav__mark-inner" /></span>
        <span>
          <strong>LeaseFlow</strong>
          <span>자산 운영</span>
        </span>
      </Link>
      <nav className="lf-app-nav__links" aria-label="관리자 메뉴">
        <Link aria-current={current === "governance" ? "page" : undefined} href="/">
          자산 정보
        </Link>
        <Link aria-current={current === "reports" ? "page" : undefined} href="/reports">
          주간 보고서
        </Link>
      </nav>
      <div className="lf-app-nav__status" aria-label="데모 상태">
        <StatusBadge tone="info">데모</StatusBadge>
      </div>
    </header>
  );
}
