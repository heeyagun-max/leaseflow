import { InvestigationCommandSchema } from "@leaseflow/ai";
import { NextResponse } from "next/server";
import { z } from "zod/v3";
import { assertDemoMode } from "@/lib/demo-mode.server";
import {
  createReportWorkflowService,
  toPublicReportWorkflow,
} from "@/lib/report-workflow-public.server";
import { classifyWorkflowError } from "@/lib/workflow-error.server";

export const dynamic = "force-dynamic";

const commonFields = {
  actor_id: z.string().min(1),
  expected_revision: z.number().int().nonnegative(),
};

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft"), ...commonFields }).strict(),
  z.object({
    action: z.literal("investigate"),
    report_id: z.string().min(1),
    command: InvestigationCommandSchema,
    ...commonFields,
  }).strict(),
  z.object({
    action: z.literal("decide_patch"),
    report_id: z.string().min(1),
    decision: z.enum(["accept", "reject"]),
    ...commonFields,
  }).strict(),
  z.object({ action: z.literal("approve"), report_id: z.string().min(1), ...commonFields }).strict(),
  z.object({
    action: z.literal("send"),
    report_id: z.string().min(1),
    idempotency_key: z.string().min(8),
    ...commonFields,
  }).strict(),
]);

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Cache-Control": "no-store",
};

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: responseHeaders });
}

function reportError(error: unknown) {
  const response = classifyWorkflowError(error);
  return json(response.body, response.status);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: responseHeaders });
}

export async function GET(request: Request) {
  try {
    assertDemoMode();
    const actorId = new URL(request.url).searchParams.get("actor_id");
    if (!actorId) throw new Error("Unknown demo actor: missing actor_id.");
    const service = createReportWorkflowService();
    return json(toPublicReportWorkflow(await service.getState(), actorId));
  } catch (error) {
    return reportError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertDemoMode();
    const input = actionSchema.parse(await request.json());
    const service = createReportWorkflowService();
    let state;
    switch (input.action) {
      case "draft":
        state = await service.draft(input);
        break;
      case "investigate":
        state = await service.investigate(input);
        break;
      case "decide_patch":
        state = await service.decidePatch(input);
        break;
      case "approve":
        state = await service.approve(input);
        break;
      case "send":
        state = await service.send(input);
        break;
    }
    return json(toPublicReportWorkflow(state, input.actor_id));
  } catch (error) {
    return reportError(error);
  }
}
