import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "Source Details" };
export default async function Page({ params }: { params: Promise<{ sourceRef: string }> }) {
  const { sourceRef } = await params;
  return <AdminPage sourceRef={sourceRef} view="source-detail" />;
}
