import type { Metadata } from "next";
import { WeeklySettingsConsole } from "@/components/weekly-settings/weekly-settings-console";

export const metadata: Metadata = { title: "Create Report Group" };

export default function Page() {
  return <WeeklySettingsConsole mode="create" />;
}
