import { NextResponse } from "next/server";
import { demoSourceUpdate, demoUsers } from "@leaseflow/demo-data";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { getDemoStore } from "@/lib/demo-store.server";
import { mutationError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertDemoMode();
    const state = await getDemoStore().getState();
    const visibleState = state.stage === "source_uploaded"
      ? {
        ...state,
        records: state.records.filter((record) => record.status === "published"),
        files: state.files.filter((file) => file.status === "published"),
        asset_registry: {
          assets: state.asset_registry.assets.filter((asset) =>
            !asset.linked_file_version_id
            || state.files.some((file) => file.id === asset.linked_file_version_id && file.status === "published")),
        },
      }
      : state;
    return NextResponse.json({
      state: visibleState,
      source: {
        id: demoSourceUpdate.id,
        buildingName: demoSourceUpdate.buildingName,
        effectiveDate: demoSourceUpdate.effectiveDate,
        title: "July leasing update",
      },
      users: demoUsers,
      storage: "Single-process DEMO_MODE JSON adapter; Supabase adapter planned.",
    });
  } catch (error) {
    return mutationError(error);
  }
}
