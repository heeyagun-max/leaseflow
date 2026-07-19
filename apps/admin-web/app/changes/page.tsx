import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "변경 검토" };
export default function Page() { return <AdminPage view="changes" />; }
