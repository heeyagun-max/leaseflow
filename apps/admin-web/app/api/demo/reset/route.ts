import { NextResponse } from "next/server";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { mutationError, parseMutationRequest } from "@/lib/api-response";
import { DemoResetCoordinator } from "@/lib/demo-reset.server";

const demoCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store",
};

function withDemoCors(response: NextResponse) {
  for (const [name, value] of Object.entries(demoCorsHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: demoCorsHeaders });
}

export async function POST(request: Request) {
  try {
    assertDemoMode();
    const input = await parseMutationRequest(request);
    const state = await new DemoResetCoordinator().reset(input);
    return NextResponse.json(
      { state },
      { headers: demoCorsHeaders },
    );
  } catch (error) {
    return withDemoCors(mutationError(error));
  }
}
