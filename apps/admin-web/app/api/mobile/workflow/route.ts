import { NextResponse } from "next/server";
import { z } from "zod/v3";
import { assertDemoMode } from "@/lib/demo-mode.server";
import { RevisionConflictError, getDemoStore } from "@/lib/demo-store.server";
import { extractSyntheticRequest } from "@/lib/request-extraction.server";
import { createPackageEditCandidate } from "@/lib/package-edit.server";
import { toPublicWorkflow } from "@/lib/mobile-workflow-public.server";
import { classifyWorkflowError } from "@/lib/workflow-error.server";

export const dynamic = "force-dynamic";

const base = { actor_id: z.string().min(1), expected_revision: z.number().int().nonnegative() };
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("import"), source: z.enum(["call", "email"]), ...base }).strict(),
  z.object({ action: z.literal("confirm"), request_id: z.string(), ...base }).strict(),
  z.object({ action: z.literal("draft"), request_id: z.string(), ...base }).strict(),
  z.object({ action: z.literal("edit"), package_id: z.string(), instruction: z.string().min(1), ...base }).strict(),
  z.object({ action: z.literal("decide"), package_id: z.string(), decision: z.enum(["accept", "reject"]), ...base }).strict(),
  z.object({ action: z.literal("approve"), package_id: z.string(), ...base }).strict(),
  z.object({ action: z.literal("send"), package_id: z.string(), idempotency_key: z.string().min(8), ...base }).strict(),
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: corsHeaders });
}

function workflowError(error: unknown) {
  const response = classifyWorkflowError(error);
  return json(response.body, response.status);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    assertDemoMode();
    return json(toPublicWorkflow(await getDemoStore().getState()));
  } catch (error) {
    return workflowError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertDemoMode();
    const input = actionSchema.parse(await request.json());
    const store = getDemoStore();
    let state;
    switch (input.action) {
      case "import": {
        const result = await extractSyntheticRequest(input.source);
        state = await store.importRequest({
          actor_id: input.actor_id, expected_revision: input.expected_revision,
          request_id: `request-${result.fixture.id}`, source: input.source,
          source_id: result.fixture.id, raw_text: result.fixture.raw_text, extraction: result.extraction,
        });
        break;
      }
      case "confirm": state = await store.confirmRequest(input); break;
      case "draft": state = await store.draftPackage(input); break;
      case "edit": {
        const current = await store.getState();
        if (current.revision !== input.expected_revision) throw new RevisionConflictError(input.expected_revision, current.revision);
        const target = current.operations.packages.find((item) => item.id === input.package_id);
        if (!target) throw new Error(`Unknown package: ${input.package_id}.`);
        const result = await createPackageEditCandidate({ subject: target.subject, facts: target.facts, files: target.files, instruction: input.instruction });
        state = await store.proposePackageEdit({ ...input, subject: result.edit.subject, body: result.edit.body });
        break;
      }
      case "decide": state = await store.decidePackageEdit(input); break;
      case "approve": state = await store.approvePackage(input); break;
      case "send": state = await store.sendPackage(input); break;
    }
    return json(toPublicWorkflow(state));
  } catch (error) {
    return workflowError(error);
  }
}
