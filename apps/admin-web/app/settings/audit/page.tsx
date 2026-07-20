import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "Delivery & Audit Log" };
export default function Page() { return <AdminPage view="settings-audit" />; }
