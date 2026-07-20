import type { Metadata } from "next";
import { ReportConsole } from "@/components/reporting/report-console";

export const metadata: Metadata = {
  title: "Weekly Reports",
  description: "건물별 주간 업무와 보고서 전달 준비 상태를 확인합니다.",
};

export default function ReportsPage() {
  return <ReportConsole />;
}
