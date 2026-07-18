import { NextResponse } from "next/server";
import { extractSyntheticSource } from "@/lib/source-extraction.server";

export async function POST() {
  const extraction = await extractSyntheticSource();
  return NextResponse.json({
    demo: extraction.mode === "credential_free_demo",
    ...extraction.candidates,
  });
}
