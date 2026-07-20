import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "Approval & Publication" };
export default function Page() { return <AdminPage view="publishing" />; }
