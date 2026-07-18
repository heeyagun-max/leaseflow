export const REPORT_INVESTIGATION_COMMANDS = [
  "통화내용 확인해서 이번주 변동사항 업데이트 해",
  "이메일 확인해서 이번주 변동사항 업데이트 해",
  "협의 중인 면적 변동 있는지 확인해",
  "협의 중인 층 변동 있는지 확인해",
  "메일이랑 전화 확인해서 경쟁빌딩 파악해봐",
] as const;

export type ReportInvestigationCommand = typeof REPORT_INVESTIGATION_COMMANDS[number];
export type ReportPatchSection =
  | "key_issue"
  | "changes_since_last_report"
  | "activity_summary"
  | "negotiated_area_floor_changes"
  | "competitor_buildings"
  | "blocker_and_pending_approval"
  | "next_actions";

export interface MobileReportView {
  id: string;
  building_id: string;
  reporting_period: { from: string; to: string };
  status: "draft" | "patch_pending" | "approved" | "sent" | "stale";
  sections: {
    key_issue: string;
    changes_since_last_report: string[];
    activity_summary: string[];
    negotiated_area_floor_changes: string[];
    competitor_buildings: string[];
    blocker_and_pending_approval: string[];
    next_actions: Array<{ action: string; owner: string; due_date: string }>;
  };
  sources: Array<{ id: string; source_type: string; occurred_at: string; summary: string }>;
  attachments: Array<{ filename: string; version_id: string }>;
  recipients: {
    configuration_id: string;
    to: Array<{ email: string; role: string }>;
    cc: Array<{ email: string; role: string }>;
  };
  cover: { subject: string; body: string };
  unresolved: string[];
  pending_candidate: {
    id: string;
    command: ReportInvestigationCommand;
    findings: Array<{ finding: string; source_reference_ids: string[]; confidence: number }>;
    operations: Array<{
      section: ReportPatchSection;
      operation: "replace" | "append" | "remove" | "reorder";
      before: unknown;
      after: unknown;
      source_reference_ids: string[];
    }>;
    unresolved: Array<{ field: string; question: string }>;
  } | null;
  accepted_patch_count: number;
  approval: { approved: boolean; approved_at: string | null };
  delivery: { sent: boolean; sent_at: string | null };
}

export interface MobileReportWorkflowView {
  revision: number;
  publication_stage: string;
  reports: MobileReportView[];
  activities: Array<{
    event_type: "report.sent.sandbox";
    report_id: string;
    building_id: string;
    occurred_at: string;
    summary: string;
  }>;
  audit: Array<{ event_label: string; occurred_at: string }>;
  labels: { mode: "DEMO"; role: "LM Manager"; delivery: "SANDBOX ONLY" };
}

export type ReportWorkflowAction =
  | { action: "draft" }
  | { action: "investigate"; report_id: string; command: ReportInvestigationCommand }
  | { action: "decide_patch"; report_id: string; decision: "accept" | "reject" }
  | { action: "approve"; report_id: string }
  | { action: "send"; report_id: string; idempotency_key: string };

export interface ReportWorkflowClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

interface ReportWorkflowErrorBody {
  code?: string;
  error?: string;
  current_revision?: number;
}

export class ReportWorkflowHttpError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly currentRevision: number | undefined;

  constructor(status: number, body: ReportWorkflowErrorBody) {
    super(body.error ?? `Report workflow request failed (${status}).`);
    this.name = "ReportWorkflowHttpError";
    this.status = status;
    this.code = body.code;
    this.currentRevision = body.current_revision;
  }
}

function endpoint(options: ReportWorkflowClientOptions): string {
  const baseUrl = (options.baseUrl
    ?? process.env.EXPO_PUBLIC_LEASEFLOW_API_URL
    ?? "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/api/mobile/reports`;
}

async function readResponse(response: Response): Promise<MobileReportWorkflowView> {
  const body = await response.json() as MobileReportWorkflowView | ReportWorkflowErrorBody;
  if (!response.ok) throw new ReportWorkflowHttpError(response.status, body as ReportWorkflowErrorBody);
  return body as MobileReportWorkflowView;
}

export async function fetchMobileReports(
  options: ReportWorkflowClientOptions = {},
): Promise<MobileReportWorkflowView> {
  return readResponse(await (options.fetcher ?? fetch)(endpoint(options), {
    headers: { Accept: "application/json" },
  }));
}

export async function mutateMobileReports(
  revision: number,
  action: ReportWorkflowAction,
  options: ReportWorkflowClientOptions = {},
): Promise<MobileReportWorkflowView> {
  return readResponse(await (options.fetcher ?? fetch)(endpoint(options), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      ...action,
      actor_id: "usr-manager",
      expected_revision: revision,
    }),
  }));
}
