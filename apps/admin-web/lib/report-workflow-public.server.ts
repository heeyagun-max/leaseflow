import type { InvestigationCommand, ReportPatchGenerationAdapter } from "@leaseflow/ai";
import type { CreateWeeklyReportDraftInput, WeeklyReport } from "@leaseflow/domain";
import { z } from "zod/v3";
import { DemoFileStore, RevisionConflictError, type DemoRuntimeState } from "./demo-store.server";
import { loadCanonicalWeeklyReportDraft } from "./mock-outlook.server";
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

  private async currentDraft(): Promise<CreateWeeklyReportDraftInput> {
    return loadCanonicalWeeklyReportDraft();
  }

  private async assertCurrentSources(report: WeeklyReport): Promise<void> {
    const current = await this.currentDraft();
    if (report.building_id !== current.building_id
      || JSON.stringify(report.sources) !== JSON.stringify(current.sources)) {
      throw new Error("Weekly-report sources diverged from the current curated external-reportable source set.");
    }
  }

  async draft(input: {
    actor_id: string;
    expected_revision: number;
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    const draft = await this.currentDraft();
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

  async approve(input: {
    actor_id: string;
    expected_revision: number;
    report_id: string;
    occurred_at?: string;
  }): Promise<DemoRuntimeState> {
    return this.store.approveWeeklyReport(input);
  }

  async send(input: {
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
  id: z.string(), building_id: z.string(), reporting_period: z.object({ from: z.string(), to: z.string() }).strict(),
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
  reports: z.array(publicReportSchema),
  activities: z.array(z.object({
    event_type: z.literal("report.sent.sandbox"), report_id: z.string(), building_id: z.string(),
    occurred_at: z.string(), summary: z.string(),
  }).strict()),
  audit: z.array(z.object({ event_label: z.string(), occurred_at: z.string() }).strict()),
  labels: z.object({ mode: z.literal("DEMO"), role: z.literal("LM Manager"), delivery: z.literal("SANDBOX ONLY") }).strict(),
}).strict();

export type PublicReportWorkflow = z.infer<typeof publicWorkflowSchema>;

export function toPublicReportWorkflow(state: DemoRuntimeState): PublicReportWorkflow {
  const scopedBuildingId = state.publication_scope.building_id;
  if (state.operations.reports.reports.some((report) => report.building_id !== scopedBuildingId
    || report.sources.some((source) => source.building_id !== scopedBuildingId)
    || report.attachments.some((attachment) => attachment.building_id !== scopedBuildingId))
    || state.operations.reports.activities.some((activity) => activity.building_id !== scopedBuildingId)) {
    throw new Error("Public weekly-report projection is blocked by cross-building state.");
  }
  return publicWorkflowSchema.parse({
    revision: state.revision,
    publication_stage: state.stage,
    reports: state.operations.reports.reports.map((report) => ({
      id: report.id,
      building_id: report.building_id,
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
    activities: state.operations.reports.activities.map(({ event_type, report_id, building_id, occurred_at, summary }) => ({
      event_type, report_id, building_id, occurred_at, summary,
    })),
    audit: state.operations.reports.audit.map(({ event_type, occurred_at }) => ({ event_label: event_type, occurred_at })),
    labels: { mode: "DEMO", role: "LM Manager", delivery: "SANDBOX ONLY" },
  });
}
