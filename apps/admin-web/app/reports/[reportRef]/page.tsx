import type { Metadata } from "next";
import { ReportConsole } from "@/components/reporting/report-console";

export const metadata: Metadata = { title: "Landlord Report Details" };
export default async function Page({ params }: { params: Promise<{ reportRef: string }> }) {
  const { reportRef } = await params;
  return <ReportConsole reportRef={reportRef} />;
}
