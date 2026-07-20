import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "Register Source" };
export default function Page() { return <AdminPage view="source-new" />; }
