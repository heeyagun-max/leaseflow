"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { AppNavigation, ADMIN_NAV_ITEMS } from "./app-navigation";
import { AdminDataProvider, useAdminData } from "./admin-data";
import { roleLabels } from "@/lib/admin-format";

const excludedRoutes = new Set(["/mobile-preview", "/design-showcase"]);

function RouteFocus() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    let focusFrame = 0;
    const routeFrame = window.requestAnimationFrame(() => {
      focusFrame = window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>("#admin-main h1")?.focus({ preventScroll: true });
      });
    });
    return () => {
      window.cancelAnimationFrame(routeFrame);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [pathname]);
  return null;
}

function Breadcrumbs() {
  const pathname = usePathname();
  const root = ADMIN_NAV_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href));
  if (!root) return null;
  const isDetail = pathname !== root.href;
  return (
    <nav className="lf-admin-breadcrumbs" aria-label="현재 위치">
      <Link href="/">오늘의 업무</Link>
      <span aria-hidden="true">/</span>
      {isDetail ? <Link href={root.href}>{root.label}</Link> : <span aria-current="page">{root.label}</span>}
      {isDetail ? <><span aria-hidden="true">/</span><span aria-current="page">상세</span></> : null}
    </nav>
  );
}

function DemoTools() {
  const { actorId, busy, mutate, setActorId, workflow } = useAdminData();
  if (!workflow) return null;
  return (
    <aside className="lf-admin-demo-tools" aria-labelledby="demo-tools-title">
      <div>
        <h2 id="demo-tools-title">데모 도구</h2>
        <p>합성 데이터만 사용합니다. 실제 이메일·전화·로그인 연결은 없습니다.</p>
      </div>
      <label>
        <span>현재 역할</span>
        <select value={actorId} onChange={(event) => setActorId(event.target.value)} disabled={busy !== null}>
          {workflow.users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.display_name} · {roleLabels[user.role as keyof typeof roleLabels] ?? "업무 담당자"}
            </option>
          ))}
        </select>
      </label>
      <button
        className="lf-admin-button lf-admin-button--quiet"
        disabled={busy !== null}
        onClick={() => {
          if (window.confirm("현재 합성 데모 진행 기록을 지우고 처음부터 시작할까요?")) void mutate("reset");
        }}
        type="button"
      >
        {busy === "reset" ? "초기화 중…" : "데모 초기화"}
      </button>
    </aside>
  );
}

function MutationNotice() {
  const { notice, reload } = useAdminData();
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);
  if (!notice) return null;
  return (
    <div
      ref={noticeRef}
      tabIndex={-1}
      className={`lf-admin-feedback lf-admin-feedback--${notice.tone}`}
      role={notice.tone === "error" ? "alert" : undefined}
      aria-live={notice.tone === "success" ? "polite" : undefined}
    >
      <h3>{notice.tone === "success" ? "업무 상태가 변경되었습니다" : "작업을 완료하지 못했습니다"}</h3>
      <p>{notice.message}</p>
      {notice.tone === "error" ? <div><button className="lf-admin-button lf-admin-button--secondary" onClick={() => void reload()} type="button">최신 내용 불러오기</button></div> : null}
    </div>
  );
}

function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="lf-skip-link" href="#admin-main">본문으로 바로가기</a>
      <div className="lf-admin-shell">
        <AppNavigation />
        <div className="lf-admin-body">
          <Breadcrumbs />
          <main id="admin-main" className="lf-admin-main" tabIndex={-1}><MutationNotice />{children}</main>
          <DemoTools />
        </div>
      </div>
      <RouteFocus />
    </>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (excludedRoutes.has(pathname)) return children;
  return (
    <AdminDataProvider>
      <AdminFrame>{children}</AdminFrame>
    </AdminDataProvider>
  );
}
