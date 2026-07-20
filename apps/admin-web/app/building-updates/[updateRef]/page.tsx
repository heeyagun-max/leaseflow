import type { Metadata } from "next";
import { BuildingUpdateConsole } from "@/components/building-updates/building-update-console";

export const metadata: Metadata = { title: "Review Building Update" };
export default async function Page({ params }: { params: Promise<{ updateRef: string }> }) {
  const { updateRef } = await params;
  return <BuildingUpdateConsole updateRef={updateRef} view="detail" />;
}
