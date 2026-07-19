import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "변경 확인" };
export default async function Page({ params }: { params: Promise<{ batchRef: string }> }) {
  const { batchRef } = await params;
  return <AdminPage batchRef={batchRef} view="change-detail" />;
}
