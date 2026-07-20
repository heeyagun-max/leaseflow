import type { Metadata } from "next";
import { WeeklyReportDetailPage } from "@/components/unified/service-pages";

export const metadata: Metadata = { title: "Building Weekly Report" };
export default async function Page({ params }: { params: Promise<{ reportRef: string }> }) {
  const { reportRef } = await params;
  return <WeeklyReportDetailPage reportRef={reportRef} />;
}
