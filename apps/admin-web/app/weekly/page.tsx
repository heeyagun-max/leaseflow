import type { Metadata } from "next";
import { WeeklyPage } from "@/components/unified/service-pages";

export const metadata: Metadata = { title: "Weekly Reports" };
export default function Page() { return <WeeklyPage />; }
