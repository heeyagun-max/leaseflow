import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "원자료 상세" };
export default async function Page({ params }: { params: Promise<{ sourceRef: string }> }) {
  const { sourceRef } = await params;
  return <AdminPage sourceRef={sourceRef} view="source-detail" />;
}
