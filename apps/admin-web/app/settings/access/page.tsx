import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "Users & Access" };
export default function Page() { return <AdminPage view="settings-access" />; }
