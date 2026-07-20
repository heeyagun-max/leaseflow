"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { AppNavigation } from "./app-navigation";
import { AdminDataProvider, useAdminData } from "./admin-data";
import { roleLabels } from "@/lib/admin-format";

const excludedRoutes = new Set(["/mobile-preview", "/design-showcase"]);

const surfaceLabels = [
  { href: "/building-updates", label: "Data intake" },
  { href: "/weekly-settings", label: "Report automation" },
  { href: "/buildings", label: "Buildings" },
  { href: "/work", label: "Requests" },
  { href: "/weekly", label: "Weekly reports" },
  { href: "/settings", label: "Audit & settings" },
] as const;

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

function CurrentSurfaceLabel() {
  const pathname = usePathname();
  const label = surfaceLabels.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Workspace";
  return <div className="lf-admin-contextbar" aria-label="Current section"><span>{label}</span></div>;
}

function DemoTools() {
  const { actorId, busy, mutate, setActorId, workflow } = useAdminData();
  if (!workflow) return null;
  return (
    <details className="lf-admin-demo-disclosure">
      <summary>Demo Settings</summary>
      <aside className="lf-admin-demo-tools" aria-labelledby="demo-tools-title">
        <div>
          <h2 id="demo-tools-title">Demo Role & Data</h2>
          <p>Synthetic data only. No live email, phone, or sign-in connections.</p>
        </div>
        <label>
          <span>Current role</span>
          <select value={actorId} onChange={(event) => setActorId(event.target.value)} disabled={busy !== null}>
            {workflow.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name} · {roleLabels[user.role as keyof typeof roleLabels] ?? "Team member"}
              </option>
            ))}
          </select>
        </label>
        <button
          className="lf-admin-button lf-admin-button--quiet"
          disabled={busy !== null}
          onClick={() => {
            if (window.confirm("Reset all synthetic demo progress and start over?")) void mutate("reset");
          }}
          type="button"
        >
          {busy === "reset" ? "Resetting…" : "Reset demo"}
        </button>
      </aside>
    </details>
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
      <h3>{notice.tone === "success" ? "Workflow updated" : "Action could not be completed"}</h3>
      <p>{notice.message}</p>
      {notice.tone === "error" ? <div><button className="lf-admin-button lf-admin-button--secondary" onClick={() => void reload()} type="button">Reload latest data</button></div> : null}
    </div>
  );
}

function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="lf-skip-link" href="#admin-main">Skip to main content</a>
      <div className="lf-admin-shell">
        <AppNavigation />
        <div className="lf-admin-body">
          <CurrentSurfaceLabel />
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
