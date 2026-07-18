import {
  generateReportPatchCandidate,
  ReportPatchSchema,
  type InvestigationCommand,
  type ReportPatch,
  type ReportPatchGenerationAdapter,
} from "@leaseflow/ai";
import type {
  WeeklyReport,
  WeeklyReportPatchCandidate,
  WeeklyReportSections,
} from "@leaseflow/domain";

export interface ReportPatchServiceOptions {
  adapter?: ReportPatchGenerationAdapter;
  environment?: { DEMO_MODE?: string; OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
}

const commandNumber: Record<InvestigationCommand, number> = {
  "통화내용 확인해서 이번주 변동사항 업데이트 해": 1,
  "이메일 확인해서 이번주 변동사항 업데이트 해": 2,
  "협의 중인 면적 변동 있는지 확인해": 3,
  "협의 중인 층 변동 있는지 확인해": 4,
  "메일이랑 전화 확인해서 경쟁빌딩 파악해봐": 5,
};

function availableIds(report: WeeklyReport, preferred: readonly string[]): string[] {
  const available = new Set(report.sources.map((source) => source.id));
  const selected = preferred.filter((id) => available.has(id));
  if (selected.length === 0) throw new Error("No external-reportable source supports this investigation command.");
  return selected;
}

function demoPatch(report: WeeklyReport, command: InvestigationCommand): ReportPatch {
  const base = { command, building_id: report.building_id, unresolved: [] as Array<{ field: string; question: string }> };
  const leaseflowIds = report.sources
    .filter((source) => source.source_type === "leaseflow_activity")
    .map((source) => source.id);
  const outlookIds = report.sources
    .filter((source) => source.source_type === "mock_outlook")
    .map((source) => source.id);
  if (command === "통화내용 확인해서 이번주 변동사항 업데이트 해") {
    const ids = availableIds(report, leaseflowIds);
    return ReportPatchSchema.parse({ ...base,
      findings: [{ category: "activity_summary", finding: "Broker requested current 5F package", source_activity_ids: ids, confidence: 0.99 }],
      operations: [{ section: "activity_summary", operation: "replace",
        before: report.current_sections.activity_summary,
        after: [...report.current_sections.activity_summary, "Call review confirmed the current 5F package request."],
        source_activity_ids: ids }],
    });
  }
  if (command === "이메일 확인해서 이번주 변동사항 업데이트 해") {
    const ids = availableIds(report, outlookIds);
    return ReportPatchSchema.parse({ ...base,
      findings: [{ category: "activity_summary", finding: "Revised package prepared after publication", source_activity_ids: ids, confidence: 0.98 }],
      operations: [{ section: "activity_summary", operation: "replace",
        before: report.current_sections.activity_summary,
        after: [...report.current_sections.activity_summary, "Email review confirmed the approved revised materials."],
        source_activity_ids: ids }],
    });
  }
  if (command === "협의 중인 면적 변동 있는지 확인해") {
    const ids = availableIds(report, [...leaseflowIds, "mail-001"]);
    return ReportPatchSchema.parse({ ...base,
      findings: [{ category: "changes_since_last_report", finding: "marketed area 300 py -> 200 py", source_activity_ids: ids, confidence: 0.99 }],
      operations: [{ section: "changes_since_last_report", operation: "replace",
        before: report.current_sections.changes_since_last_report,
        after: [...report.current_sections.changes_since_last_report, "Negotiated marketed area confirmed at 200 py."],
        source_activity_ids: ids }],
    });
  }
  if (command === "협의 중인 층 변동 있는지 확인해") {
    const ids = availableIds(report, outlookIds.includes("mail-001") ? ["mail-001"] : outlookIds);
    return ReportPatchSchema.parse({ ...base,
      findings: [{ category: "changes_since_last_report", finding: "5F plan v1 -> v2", source_activity_ids: ids, confidence: 0.97 }],
      operations: [{ section: "changes_since_last_report", operation: "replace",
        before: report.current_sections.changes_since_last_report,
        after: [...report.current_sections.changes_since_last_report, "Negotiated floor remains 5F under floor-plan v2."],
        source_activity_ids: ids }],
    });
  }
  const ids = availableIds(report, [...leaseflowIds, ...outlookIds]);
  return ReportPatchSchema.parse({ ...base,
    findings: [{ category: "competitor_buildings", finding: "No source-backed competitor building was identified.", source_activity_ids: ids, confidence: 0.95 }],
    operations: [{ section: "competitor_buildings", operation: "replace",
      before: report.current_sections.competitor_buildings,
      after: report.current_sections.competitor_buildings,
      source_activity_ids: ids }],
    unresolved: [{ field: "competitor_buildings", question: "No external-reportable competitor evidence is available." }],
  });
}

function sectionName(section: ReportPatch["operations"][number]["section"]): keyof WeeklyReportSections {
  if (section === "blocker") return "blocker_and_pending_approval";
  if (section === "next_action") return "next_actions";
  return section;
}

function domainValue(
  section: ReportPatch["operations"][number]["section"],
  value: string | string[],
  current: WeeklyReportSections,
): unknown {
  if (section === "blocker") return typeof value === "string" ? [value] : value;
  if (section === "next_action") {
    const actions = typeof value === "string" ? [value] : value;
    const fallback = current.next_actions[0] ?? { owner: "LM Manager", due_date: "2026-07-20" };
    return actions.map((action) => ({ action, owner: fallback.owner, due_date: fallback.due_date }));
  }
  return value;
}

function toDomainCandidate(report: WeeklyReport, patch: ReportPatch): WeeklyReportPatchCandidate {
  const sourceIds = new Set(report.sources.map((source) => source.id));
  for (const sourceId of [
    ...patch.findings.flatMap((finding) => finding.source_activity_ids),
    ...patch.operations.flatMap((operation) => operation.source_activity_ids),
  ]) {
    if (!sourceIds.has(sourceId)) throw new Error(`Report patch references unavailable source ${sourceId}.`);
  }
  return {
    id: `report-patch-${report.id}-${commandNumber[patch.command]}`,
    command: patch.command,
    target_building_ids: [patch.building_id],
    findings: patch.findings.map((finding) => ({
      category: sectionName(finding.category),
      finding: finding.finding,
      source_reference_ids: [...finding.source_activity_ids],
      confidence: finding.confidence,
    })),
    operations: patch.operations.map((operation) => ({
      section: sectionName(operation.section),
      operation: operation.operation,
      before: domainValue(operation.section, operation.before, report.current_sections),
      after: domainValue(operation.section, operation.after, report.current_sections),
      source_reference_ids: [...operation.source_activity_ids],
    })),
    unresolved: patch.unresolved.map((item) => ({ ...item })),
  };
}

export async function createWeeklyReportPatchCandidate(
  report: WeeklyReport,
  command: InvestigationCommand,
  options: ReportPatchServiceOptions = {},
): Promise<{ mode: "live" | "credential_free_demo"; candidate: WeeklyReportPatchCandidate }> {
  const environment = options.environment ?? process.env;
  const outlook = report.sources.filter((source) => source.source_type === "mock_outlook");
  const appActivity = report.sources.filter((source) => source.source_type === "leaseflow_activity");
  const patch = environment.DEMO_MODE === "true" && !environment.OPENAI_API_KEY
    ? demoPatch(report, command)
    : await generateReportPatchCandidate({
      building_id: report.building_id,
      report_period: `${report.reporting_period.from}/${report.reporting_period.to}`,
      current_report: report.current_sections,
      app_activity: appActivity,
      mock_outlook_activity: outlook,
      command,
      ...(environment.OPENAI_MODEL ? { model: environment.OPENAI_MODEL } : {}),
    }, { ...(options.adapter ? { adapter: options.adapter } : {}) });
  return {
    mode: environment.DEMO_MODE === "true" && !environment.OPENAI_API_KEY ? "credential_free_demo" : "live",
    candidate: toDomainCandidate(report, patch),
  };
}
