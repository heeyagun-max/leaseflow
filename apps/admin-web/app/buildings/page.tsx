import type { Metadata } from "next";
import { BuildingsPage } from "@/components/unified/service-pages";

export const metadata: Metadata = { title: "Buildings" };
export default function Page() { return <BuildingsPage />; }
