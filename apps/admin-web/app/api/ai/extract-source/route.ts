import { NextResponse } from "next/server";
import { SourceCandidateSchema, createStructuredResponse } from "@leaseflow/ai";

export async function POST(request: Request) {
  const body = await request.json();
  if (process.env.DEMO_MODE === "true" && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({demo:true, building_id:"bld-cobalt", effective_date:"2026-07-18", changes:body.changes ?? [], unresolved:[]});
  }
  const result = await createStructuredResponse({
    schema: SourceCandidateSchema,
    schemaName: "leaseflow_source_candidate",
    developer: "Extract candidate leasing-data changes. Never approve or publish. Include source pointers and unresolved items.",
    user: JSON.stringify(body),
  });
  return NextResponse.json(result);
}
