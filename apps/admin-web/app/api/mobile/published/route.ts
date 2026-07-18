import { NextResponse } from "next/server";
import { createMobilePublishedSnapshot } from "@leaseflow/demo-data";
import { mutationError } from "@/lib/api-response";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { getDemoStore } from "@/lib/demo-store.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertDemoMode();
    const state = await getDemoStore().getState();
    return NextResponse.json(createMobilePublishedSnapshot(state), {
      headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return mutationError(error);
  }
}
