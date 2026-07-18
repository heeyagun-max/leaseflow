import { NextResponse } from "next/server";
import { getDemoStore } from "@/lib/demo-store.server";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { mutationError, parseMutationRequest } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    assertDemoMode();
    const input = await parseMutationRequest(request);
    return NextResponse.json({ state: await getDemoStore().publish(input) });
  } catch (error) {
    return mutationError(error);
  }
}
