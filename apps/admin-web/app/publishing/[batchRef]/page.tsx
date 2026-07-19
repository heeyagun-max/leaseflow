import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "승인 검토" };
export default async function Page({ params }: { params: Promise<{ batchRef: string }> }) {
  const { batchRef } = await params;
  return <AdminPage batchRef={batchRef} view="publishing-detail" />;
}
