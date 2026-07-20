import { NextResponse } from "next/server";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { loadOperationsSnapshotPublic } from "@/lib/operations-snapshot-public.server";
import { classifyWorkflowError } from "@/lib/workflow-error.server";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Cache-Control": "no-store",
};

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: responseHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: responseHeaders });
}

export async function GET(request: Request) {
  try {
    assertDemoMode();
    const actorId = new URL(request.url).searchParams.get("actor_id");
    if (!actorId) throw new Error("Unknown demo actor: missing actor_id.");
    return json(await loadOperationsSnapshotPublic(actorId));
  } catch (error) {
    const response = classifyWorkflowError(error);
    return json(response.body, response.status);
  }
}
