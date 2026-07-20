import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "Current Operations Data" };
export default function Page() { return <AdminPage view="operations" />; }
