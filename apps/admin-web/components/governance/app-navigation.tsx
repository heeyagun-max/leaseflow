import Link from "next/link";

interface AppNavigationProps {
  current: "governance" | "reports";
}

const ADMIN_NAV_ITEMS = [
  { label: "대시보드", href: "/#overview", key: "dashboard", mark: "대" },
  { label: "원자료 등록부", href: "/#source-assets", key: "source", mark: "원" },
  { label: "검토·게시", href: "/", key: "governance", mark: "검" },
  { label: "건물", href: "/#published-records", key: "buildings", mark: "건" },
  { label: "보고그룹", href: "/reports#report-group", key: "report-groups", mark: "그" },
  { label: "보고일정", href: "/reports", key: "reports", mark: "일" },
  { label: "사용자·권한", href: "/#role-control", key: "users", mark: "권" },
  { label: "발송·감사", href: "/#audit-trail", key: "audit", mark: "감" },
] as const;

export function AppNavigation({ current }: AppNavigationProps) {
  return (
    <aside className="lf-app-nav">
      <Link className="lf-app-nav__brand" href="/" aria-label="LeaseFlow 자산 운영 홈">
        <span>
          <strong>LeaseFlow</strong>
          <span>자산 운영 대장</span>
        </span>
      </Link>
      <nav className="lf-app-nav__links" aria-label="관리자 메뉴">
        {ADMIN_NAV_ITEMS.map((item) => {
          const selected = item.key === current;
          return (
            <Link aria-current={selected ? "page" : undefined} href={item.href} key={item.key}>
              <span className="lf-app-nav__item-mark" aria-hidden="true">{item.mark}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="lf-app-nav__account">
        <span className="lf-app-nav__avatar" aria-hidden="true">데</span>
        <span><strong>합성 데이터 데모</strong><small>담당자는 화면에서 선택</small></span>
      </div>
    </aside>
  );
}
