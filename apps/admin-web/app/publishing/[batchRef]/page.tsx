import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "Publication Review" };
export default async function Page({ params }: { params: Promise<{ batchRef: string }> }) {
  const { batchRef } = await params;
  return <AdminPage batchRef={batchRef} view="publishing-detail" />;
}
