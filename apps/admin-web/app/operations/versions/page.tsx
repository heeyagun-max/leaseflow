import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "Version History" };
export default function Page() { return <AdminPage view="operation-versions" />; }
