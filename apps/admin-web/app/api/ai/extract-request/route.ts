import { NextResponse } from "next/server";
import { RequestSchema, createStructuredResponse } from "@leaseflow/ai";

export async function POST(request: Request) {
  const body = await request.json();
  if (process.env.DEMO_MODE === "true" && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({demo:true, language:"ko", building_mentions:[{text:"코발트 파이낸스센터",resolved_building_id:"bld-cobalt",confidence:0.99}], floor:"5F", requested_fields:["marketed_area","rent_free","supported_parking"], requested_files:["current_floor_plan"], recipient:{name:null,organization:null}, deadline:"today afternoon", ambiguities:[]});
  }
  const result = await createStructuredResponse({
    schema: RequestSchema,
    schemaName: "leaseflow_request",
    developer: "Extract a leasing-work request. Do not invent official property facts.",
    user: JSON.stringify(body),
  });
  return NextResponse.json(result);
}
