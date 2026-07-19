import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "사용자·권한" };
export default function Page() { return <AdminPage view="settings-access" />; }
