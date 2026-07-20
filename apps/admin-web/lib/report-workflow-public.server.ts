import type { InvestigationCommand, ReportPatchGenerationAdapter } from "@leaseflow/ai";
import { canPerformWeeklyReportAction, type CreateWeeklyReportDraftInput, type UserRole, type WeeklyReport } from "@leaseflow/domain";
import { demoUsers, demoWeeklyReportBuildingName } from "@leaseflow/demo-data";
import { z } from "zod/v3";
import { DemoFileStore, RevisionConflictError, type DemoRuntimeState } from "./demo-store.server";
import { createWeeklyReportPatchCandidate } from "./report-patch.server";

export interface ReportWorkflowServiceOptions {
  store?: DemoFileStore;
  patchAdapter?: ReportPatchGenerationAdapter;
}

export class ReportWorkflowService {
  readonly store: DemoFileStore;
  private readonly patchAdapter: ReportPatchGenerationAdapter | undefined;

  constructor(options: ReportWorkflowServiceOptions = {}) {
    this.store = options.store ?? new DemoFileStore();
    this.patchAdapter = options.patchAdapter;
  }

  getState(): Promise<DemoRuntimeState> {
    return this.store.getState();
  }

  private currentDraft(buildingId: string): Promise<CreateWeeklyReportDraftInput> {
    return this.store.getCanonicalWeeklyReportDraft(buildingId);
  }

  private async assertCurrentSources(report: WeeklyReport): Promise<void> {
    const current = await this.currentDraft(report.building_id);
    if (report.building_id !== current.building_id
      || JSON.stringify(report.sources) !== JSON.stringify(current.sources)) {
      throw new Error("Weekly-report sources diverged from the current curated external-reportable source set.");
    }
  }

  async draft(input: {
    actor_id: string;
    expected_revision: number;
    building_id: string;
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    const draft = await this.currentDraft(input.building_id);
    return this.store.draftWeeklyReport({ ...input, draft });
  }

  async investigate(input: {
    actor_id: string;
    expected_revision: number;
    report_id: string;
    command: InvestigationCommand;
    occurred_at?: string;
    environment?: { DEMO_MODE?: string; OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
  }): Promise<DemoRuntimeState> {
    const state = await this.store.getState();
    if (state.revision !== input.expected_revision) {
      throw new RevisionConflictError(input.expected_revision, state.revision);
    }
    const report = state.operations.reports.reports.find((item) => item.id === input.report_id);
    if (!report) throw new Error(`Unknown weekly report: ${input.report_id}.`);
    if (report.status !== "draft") throw new Error("Only a draft weekly report can receive a patch candidate.");
    await this.store.assertWeeklyReportPreparationAccess(input);
    await this.assertCurrentSources(report);
    const { candidate } = await createWeeklyReportPatchCandidate(report, input.command, {
      ...(this.patchAdapter ? { adapter: this.patchAdapter } : {}),
      ...(input.environment ? { environment: input.environment } : {}),
    });
    return this.store.proposeWeeklyReportPatch({
      actor_id: input.actor_id,
      expected_revision: input.expected_revision,
      report_id: input.report_id,
      candidate,
      ...(input.occurred_at ? { occurred_at: input.occurred_at } : {}),
    });
  }

  decidePatch(input: {
    actor_id: string;
    expected_revision: number;
    report_id: string;
    decision: "accept" | "reject";
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    return this.store.decideWeeklyReportPatch(input);
  }

  approve(input: {
    actor_id: string;
    expected_revision: number;
    report_id: string;
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    return this.store.approveWeeklyReport(input);
  }

  send(input: {
    actor_id: string;
    expected_revision: number;
    report_id: string;
    idempotency_key: string;
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    return this.store.sendWeeklyReport(input);
  }
}

export function createReportWorkflowService(options: ReportWorkflowServiceOptions = {}): ReportWorkflowService {
  return new ReportWorkflowService(options);
}

const publicReportSchema = z.object({
  id: z.string(), building_id: z.string(), building_label: z.string(), reporting_period: z.object({ from: z.string(), to: z.string() }).strict(),
  status: z.enum(["draft", "patch_pending", "approved", "sent", "stale"]),
  sections: z.object({
    key_issue: z.string(), changes_since_last_report: z.array(z.string()), activity_summary: z.array(z.string()),
    negotiated_area_floor_changes: z.array(z.string()), competitor_buildings: z.array(z.string()),
    blocker_and_pending_approval: z.array(z.string()),
    next_actions: z.array(z.object({ action: z.string(), owner: z.string(), due_date: z.string() }).strict()),
  }).strict(),
  sources: z.array(z.object({ id: z.string(), source_type: z.string(), occurred_at: z.string(), summary: z.string() }).strict()),
  attachments: z.array(z.object({ filename: z.string(), version_id: z.string() }).strict()),
  recipients: z.object({
    configuration_id: z.string(),
    to: z.array(z.object({ email: z.string(), role: z.string() }).strict()),
    cc: z.array(z.object({ email: z.string(), role: z.string() }).strict()),
  }).strict(),
  cover: z.object({ subject: z.string(), body: z.string() }).strict(),
  unresolved: z.array(z.string()),
  pending_candidate: z.object({
    id: z.string(), command: z.string(),
    findings: z.array(z.object({ finding: z.string(), source_reference_ids: z.array(z.string()), confidence: z.number() }).strict()),
    operations: z.array(z.object({ section: z.string(), operation: z.string(), before: z.unknown(), after: z.unknown(), source_reference_ids: z.array(z.string()) }).strict()),
    unresolved: z.array(z.object({ field: z.string(), question: z.string() }).strict()),
  }).strict().nullable(),
  accepted_patch_count: z.number().int().nonnegative(),
  approval: z.object({ approved: z.boolean(), approved_at: z.string().nullable() }).strict(),
  delivery: z.object({ sent: z.boolean(), sent_at: z.string().nullable() }).strict(),
}).strict();

const publicWorkflowSchema = z.object({
  revision: z.number().int().nonnegative(),
  publication_stage: z.string(),
  allowedActions: z.array(z.enum(["draft", "investigate", "decide_patch", "approve", "send"])),
  reports: z.array(publicReportSchema),
  activities: z.array(z.object({
    event_type: z.literal("report.sent.sandbox"), report_id: z.string(), building_id: z.string(),
    occurred_at: z.string(), summary: z.string(),
  }).strict()),
  audit: z.array(z.object({
    report_id: z.string(), event_label: z.string(), occurred_at: z.string(),
    actor_label: z.string(), actor_role_label: z.string(),
  }).strict()),
  labels: z.object({ mode: z.literal("DEMO"), delivery: z.literal("SANDBOX ONLY") }).strict(),
}).strict();

export type PublicReportWorkflow = z.infer<typeof publicWorkflowSchema>;

const reportAuditLabels: Record<DemoRuntimeState["operations"]["reports"]["audit"][number]["event_type"], string> = {
  "report.drafted": "임대인 보고 초안 작성",
  "report.patch_proposed": "보고 변경안 생성",
  "report.patch_accepted": "보고 변경안 반영",
  "report.patch_rejected": "보고 변경안 유지",
  "report.approved": "임대인 보고 승인",
  "report.sent.sandbox": "데모 발송 기록",
  "report.marked_stale": "보고 최신성 재확인 필요",
};

const roleLabels: Record<UserRole, string> = {
  data_steward: "데이터 담당자",
  senior_reviewer: "선임 검토자",
  lm_manager: "임대 관리 책임자",
  lm_member: "임대 관리자",
  team_lead: "팀 책임자",
  admin: "시스템 관리자",
};

function reportAllowedActions(role: UserRole) {
  return [
    ...(canPerformWeeklyReportAction(role, "report.prepare") ? ["draft", "investigate", "decide_patch"] as const : []),
    ...(canPerformWeeklyReportAction(role, "report.approve") ? ["approve"] as const : []),
    ...(canPerformWeeklyReportAction(role, "report.send") ? ["send"] as const : []),
  ];
}

export function canViewReportAudit(role: UserRole) {
  return role === "lm_manager" || role === "admin";
}

export function toPublicReportWorkflow(
  state: DemoRuntimeState,
  actorId: string,
  authorizedBuildingIds: readonly string[],
): PublicReportWorkflow {
  const actor = demoUsers.find((user) => user.id === actorId);
  if (!actor) throw new Error(`Unknown demo actor: ${actorId}.`);
  const allowedBuildings = new Set(authorizedBuildingIds);
  const reports = state.operations.reports.reports.filter((report) => allowedBuildings.has(report.building_id));
  if (reports.some((report) => report.sources.some((source) => source.building_id !== report.building_id)
    || report.attachments.some((attachment) => attachment.building_id !== report.building_id))) {
    throw new Error("Public weekly-report projection is blocked by cross-building report material.");
  }
  const reportIds = new Set(reports.map((report) => report.id));
  const activities = state.operations.reports.activities.filter((activity) =>
    allowedBuildings.has(activity.building_id) && reportIds.has(activity.report_id));
  const audit = state.operations.reports.audit.filter((event) => reportIds.has(event.report_id));
  return publicWorkflowSchema.parse({
    revision: state.revision,
    publication_stage: state.stage,
    allowedActions: reportAllowedActions(actor.role),
    reports: reports.map((report) => ({
      id: report.id,
      building_id: report.building_id,
      building_label: demoWeeklyReportBuildingName(report.building_id) ?? "건물 확인 필요",
      reporting_period: report.reporting_period,
      status: report.status,
      sections: report.current_sections,
      sources: report.sources.map(({ id, source_type, occurred_at, summary }) => ({ id, source_type, occurred_at, summary })),
      attachments: report.attachments.map(({ filename, version_id }) => ({ filename, version_id })),
      recipients: report.recipients,
      cover: report.cover,
      unresolved: report.unresolved,
      pending_candidate: report.pending_candidate ? {
        id: report.pending_candidate.id,
        command: report.pending_candidate.command,
        findings: report.pending_candidate.findings.map(({ finding, source_reference_ids, confidence }) => ({ finding, source_reference_ids, confidence })),
        operations: report.pending_candidate.operations.map(({ section, operation, before, after, source_reference_ids }) => ({ section, operation, before, after, source_reference_ids })),
        unresolved: report.pending_candidate.unresolved,
      } : null,
      accepted_patch_count: report.accepted_patch_history.length,
      approval: {
        approved: report.status === "approved" || report.status === "sent",
        approved_at: report.approval.approved_at,
      },
      delivery: {
        sent: report.status === "sent",
        sent_at: report.delivery.sent_at,
      },
    })),
    activities: activities.map(({ event_type, report_id, building_id, occurred_at, summary }) => ({
      event_type, report_id, building_id, occurred_at, summary,
    })),
    audit: canViewReportAudit(actor.role) ? audit.map(({ report_id, event_type, occurred_at, actor_id, actor_role }) => ({
      report_id,
      event_label: reportAuditLabels[event_type],
      occurred_at,
      actor_label: demoUsers.find((user) => user.id === actor_id)?.display_name ?? "알 수 없는 데모 사용자",
      actor_role_label: roleLabels[actor_role],
    })) : [],
    labels: { mode: "DEMO", delivery: "SANDBOX ONLY" },
  });
}
