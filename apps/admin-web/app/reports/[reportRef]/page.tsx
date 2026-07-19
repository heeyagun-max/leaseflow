import type { Metadata } from "next";
import { ReportConsole } from "@/components/reporting/report-console";

export const metadata: Metadata = { title: "임대인 보고 상세" };
export default async function Page({ params }: { params: Promise<{ reportRef: string }> }) {
  const { reportRef } = await params;
  return <ReportConsole reportRef={reportRef} />;
}
