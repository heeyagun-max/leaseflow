import type { Metadata } from "next";
import { BuildingUpdateConsole } from "@/components/building-updates/building-update-console";

export const metadata: Metadata = { title: "Building Change History" };
export default function Page() { return <BuildingUpdateConsole view="history" />; }
