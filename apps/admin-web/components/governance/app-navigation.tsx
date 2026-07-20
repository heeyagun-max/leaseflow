"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@leaseflow/domain";
import { useEffect, useRef } from "react";
import { useAdminData } from "./admin-data";

export const ADMIN_NAV_ITEMS = [
  { label: "Workspace", href: "/" },
  { label: "Requests", href: "/work" },
  { label: "Buildings", href: "/buildings" },
  { label: "Weekly Reports", href: "/weekly" },
] as const;

const MANAGEMENT_NAV_ITEMS = [
  { label: "Building Data Intake", href: "/building-updates" },
  { label: "Report Automation", href: "/weekly-settings" },
  { label: "Audit & Settings", href: "/settings" },
] as const;

const BUILDING_UPDATE_ROLES = new Set<UserRole>(["data_steward", "senior_reviewer", "admin"]);
const SETTINGS_ROLES = new Set<UserRole>(["lm_manager", "admin"]);

export function navigationItemsForRole(role: UserRole | undefined) {
  return {
    common: ADMIN_NAV_ITEMS,
    management: role ? MANAGEMENT_NAV_ITEMS.filter((item) => (
      item.href === "/building-updates" ? BUILDING_UPDATE_ROLES.has(role) : SETTINGS_ROLES.has(role)
    )) : [],
  };
}

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { actorId, workflow } = useAdminData();
  const role = workflow?.users.find((user) => user.id === actorId)?.role;
  const { common, management: managementItems } = navigationItemsForRole(role);
  return (
    <nav className="lf-admin-nav__links" aria-label="Global navigation">
      <div className="lf-admin-nav__group" aria-label="Operations">
        {common.map((item) => (
          <Link aria-current={isCurrent(pathname, item.href) ? "page" : undefined} href={item.href} key={item.href} {...(onNavigate ? { onClick: onNavigate } : {})}>
            {item.label}
          </Link>
        ))}
      </div>
      {managementItems.length ? <div className="lf-admin-nav__group lf-admin-nav__group--secondary" aria-label="Administration">
        {managementItems.map((item) => (
          <Link aria-current={isCurrent(pathname, item.href) ? "page" : undefined} href={item.href} key={item.href} {...(onNavigate ? { onClick: onNavigate } : {})}>
            {item.label}
          </Link>
        ))}
      </div> : null}
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
      <aside className="lf-admin-nav" aria-label="LeaseFlow global navigation">
        <Link className="lf-admin-nav__brand" href="/" aria-label="LeaseFlow workspace">
          <strong>LeaseFlow</strong>
        </Link>
        <NavLinks />
      </aside>

      <header className="lf-admin-appbar">
        <Link href="/" className="lf-admin-appbar__brand">LeaseFlow</Link>
        <button ref={triggerRef} type="button" onClick={openDrawer} aria-haspopup="dialog">
          Open menu
        </button>
      </header>

      <dialog ref={dialogRef} className="lf-admin-drawer" aria-labelledby="admin-drawer-title">
        <div className="lf-admin-drawer__panel">
          <div className="lf-admin-drawer__heading">
            <h2 id="admin-drawer-title">Navigation</h2>
            <button type="button" onClick={closeDrawer}>Close menu</button>
          </div>
          <NavLinks onNavigate={closeDrawer} />
        </div>
      </dialog>
    </>
  );
}
