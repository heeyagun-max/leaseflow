import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "자료 등록 안내" };
export default function Page() { return <AdminPage view="source-new" />; }
