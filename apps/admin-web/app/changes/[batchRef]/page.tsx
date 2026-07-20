import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "Review Changes" };
export default async function Page({ params }: { params: Promise<{ batchRef: string }> }) {
  const { batchRef } = await params;
  return <AdminPage batchRef={batchRef} view="change-detail" />;
}
