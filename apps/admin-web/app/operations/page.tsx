import type { Metadata } from "next";
import { AdminPage } from "@/components/governance/admin-pages";

export const metadata: Metadata = { title: "운영 정보" };
export default function Page() { return <AdminPage view="operations" />; }
