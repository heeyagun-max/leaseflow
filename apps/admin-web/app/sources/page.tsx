import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "원자료" };
export default function Page() {
  return <Suspense fallback={<><header className="lf-admin-page-header"><h1 tabIndex={-1}>원자료</h1></header><section aria-labelledby="source-loading-heading"><h2 id="source-loading-heading">원자료 목록</h2><div className="lf-admin-skeleton" aria-busy="true"><span /><span /><span /></div></section></>}><AdminPage view="sources" /></Suspense>;
}
