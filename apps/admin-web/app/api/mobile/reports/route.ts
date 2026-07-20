import { InvestigationCommandSchema } from "@leaseflow/ai";
import { NextResponse } from "next/server";
import { z } from "zod/v3";
import { assertDemoMode } from "@/lib/demo-mode.server";
import {
  createReportWorkflowService,
  toPublicReportWorkflow,
} from "@/lib/report-workflow-public.server";
import { loadDemoRuntimeConfiguration, WorkflowAccessError } from "@/lib/demo-store.server";
import { classifyWorkflowError } from "@/lib/workflow-error.server";

export const dynamic = "force-dynamic";

const commonFields = {
  actor_id: z.string().min(1),
  expected_revision: z.number().int().nonnegative(),
};

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("draft"),
    building_id: z.enum(["bld-cobalt", "bld-pacific-gate", "bld-teheran-link"]),
    ...commonFields,
  }).strict(),
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

function authorizedBuildingIds(
  configuration: Awaited<ReturnType<typeof loadDemoRuntimeConfiguration>>,
  actorId: string,
): string[] {
  const buildingIds = configuration.access.users.find((entry) => entry.user_id === actorId)?.building_ids;
  if (!buildingIds) throw new WorkflowAccessError("현재 사용자의 건물 권한을 찾을 수 없습니다.");
  return buildingIds;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: responseHeaders });
}

export async function GET(request: Request) {
  try {
    assertDemoMode();
    const searchParams = new URL(request.url).searchParams;
    const actorId = searchParams.get("actor_id");
    if (!actorId) throw new Error("Unknown demo actor: missing actor_id.");
    const service = createReportWorkflowService();
    const [state, configuration] = await Promise.all([service.getState(), loadDemoRuntimeConfiguration()]);
    const projection = toPublicReportWorkflow(state, actorId, authorizedBuildingIds(configuration, actorId));
    const reportId = searchParams.get("report_id");
    if (!reportId) return json(projection);
    const selected = projection.reports.find((report) => report.id === reportId);
    if (!selected) {
      if (state.operations.reports.reports.some((report) => report.id === reportId)) {
        throw new WorkflowAccessError("이 건물 보고를 볼 권한이 없습니다.");
      }
      throw new Error(`Unknown weekly report: ${reportId}.`);
    }
    return json({
      ...projection,
      reports: [selected],
      activities: projection.activities.filter((activity) => activity.report_id === selected.id),
      audit: projection.audit.filter((event) => event.report_id === selected.id),
    });
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
    const configuration = await loadDemoRuntimeConfiguration();
    return json(toPublicReportWorkflow(state, input.actor_id, authorizedBuildingIds(configuration, input.actor_id)));
  } catch (error) {
    return reportError(error);
  }
}
