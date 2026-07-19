"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export const ADMIN_NAV_ITEMS = [
  { label: "오늘의 업무", href: "/" },
  { label: "원자료", href: "/sources" },
  { label: "변경 검토", href: "/changes" },
  { label: "승인·게시", href: "/publishing" },
  { label: "운영 정보", href: "/operations" },
  { label: "임대인 보고", href: "/reports" },
  { label: "설정·기록", href: "/settings" },
] as const;

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="lf-admin-nav__links" aria-label="관리자 전역 메뉴">
      {ADMIN_NAV_ITEMS.map((item) => (
        <Link
          aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
          href={item.href}
          key={item.href}
          {...(onNavigate ? { onClick: onNavigate } : {})}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppNavigation() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openDrawer() {
    dialogRef.current?.showModal();
  }

  function closeDrawer() {
    dialogRef.current?.close();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const restoreFocus = () => triggerRef.current?.focus();
    dialog.addEventListener("close", restoreFocus);
    return () => dialog.removeEventListener("close", restoreFocus);
  }, []);

  return (
    <>
      <aside className="lf-admin-nav" aria-label="관리자 전역 탐색">
        <Link className="lf-admin-nav__brand" href="/" aria-label="LeaseFlow 오늘의 업무">
          <strong>LeaseFlow</strong>
          <span>운영 정보 대장</span>
        </Link>
        <NavLinks />
      </aside>

      <header className="lf-admin-appbar">
        <Link href="/" className="lf-admin-appbar__brand">LeaseFlow</Link>
        <button ref={triggerRef} type="button" onClick={openDrawer} aria-haspopup="dialog">
          메뉴 열기
        </button>
      </header>

      <dialog ref={dialogRef} className="lf-admin-drawer" aria-labelledby="admin-drawer-title">
        <div className="lf-admin-drawer__panel">
          <div className="lf-admin-drawer__heading">
            <h2 id="admin-drawer-title">관리자 메뉴</h2>
            <button type="button" onClick={closeDrawer}>메뉴 닫기</button>
          </div>
          <NavLinks onNavigate={closeDrawer} />
        </div>
      </dialog>
    </>
  );
}
