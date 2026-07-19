import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "승인·게시" };
export default function Page() { return <AdminPage view="publishing" />; }
