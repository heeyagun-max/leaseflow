import type { Metadata } from "next";
import { BuildingDetailPage } from "@/components/unified/service-pages";

export const metadata: Metadata = { title: "Building Details" };
export default async function Page({ params }: { params: Promise<{ buildingRef: string }> }) {
  const { buildingRef } = await params;
  return <BuildingDetailPage buildingRef={buildingRef} />;
}
