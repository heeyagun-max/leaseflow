import type { Metadata } from "next";
import { ReportConsole } from "@/components/reporting/report-console";

export const metadata: Metadata = {
  title: "Weekly Reports",
  description: "Governed, source-backed weekly landlord report workflow in synthetic demo mode.",
};

export default function ReportsPage() {
  return <ReportConsole />;
}
