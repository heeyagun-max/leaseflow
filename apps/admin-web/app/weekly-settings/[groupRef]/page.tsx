import type { Metadata } from "next";
import { WeeklySettingsConsole } from "@/components/weekly-settings/weekly-settings-console";

export const metadata: Metadata = { title: "Edit Report Group" };

export default async function Page({ params }: { params: Promise<{ groupRef: string }> }) {
  const { groupRef } = await params;
  return <WeeklySettingsConsole groupRef={groupRef} mode="edit" />;
}
