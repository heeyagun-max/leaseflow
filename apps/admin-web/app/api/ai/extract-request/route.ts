import { NextResponse } from "next/server";
import { z } from "zod/v3";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { extractSyntheticRequest } from "@/lib/request-extraction.server";

const requestSchema = z.object({ source: z.enum(["call", "email"]) }).strict();

export async function POST(request: Request) {
  try {
    assertDemoMode();
    const { source } = requestSchema.parse(await request.json());
    const result = await extractSyntheticRequest(source);
    return NextResponse.json({ mode: result.mode, extraction: result.extraction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request extraction input.";
    const status = message.includes("DEMO_MODE=true") ? 404 : 400;
    return NextResponse.json({ code: status === 404 ? "DEMO_DISABLED" : "INVALID_REQUEST", error: message }, { status });
  }
}
