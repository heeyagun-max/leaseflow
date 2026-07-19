import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "파일 이력" };
export default function Page() { return <AdminPage view="operation-files" />; }
