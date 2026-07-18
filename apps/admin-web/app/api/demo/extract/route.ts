import { NextResponse } from "next/server";
import { getDemoStore } from "@/lib/demo-store.server";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { extractSyntheticSource } from "@/lib/source-extraction.server";
import { mutationError, parseMutationRequest } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    assertDemoMode();
    const input = await parseMutationRequest(request);
    const extraction = await extractSyntheticSource();
    return NextResponse.json({
      extraction_mode: extraction.mode,
      state: await getDemoStore().extract(input, extraction.candidates),
    });
  } catch (error) {
    return mutationError(error);
  }
}
