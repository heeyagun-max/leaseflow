"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDate, formatDateTime, safeWorkflowError } from "@/lib/admin-format";
import { useAdminData, type PublicReport, type ReportSections, type ReportWorkflow } from "@/components/governance/admin-data";

const EMAIL_INVESTIGATION = "이메일 확인해서 이번주 변동사항 업데이트 해" as const;

type BusyAction = "approve" | "draft" | "investigate" | "patch-accept" | "patch-reject" | "send";
type ReportMutationAction = "approve" | "draft" | "investigate" | "decide_patch" | "send";
type Notice = { message: string; tone: "error" | "success" };

export function selectReportByRef(reports: readonly PublicReport[], reportRef: string | undefined) {
  return reportRef ? reports.find((report) => report.id === reportRef) : undefined;
}

export function buildReportMutationBody(input: {
  action: ReportMutationAction;
  actorId: string;
  decision?: "accept" | "reject";
  buildingId?: string;
  reportId?: string;
  revision: number;
}) {
  const body: Record<string, unknown> = {
    action: input.action,
    actor_id: input.actorId,
    expected_revision: input.revision,
  };
  if (input.action === "draft") body.building_id = input.buildingId;
  else body.report_id = input.reportId;
  if (input.action === "investigate") body.command = EMAIL_INVESTIGATION;
  if (input.action === "decide_patch") body.decision = input.decision;
  if (input.action === "send" && input.reportId) body.idempotency_key = `sandbox-${input.reportId}-delivery`;
  return body;
}

const reportStatusLabels: Record<PublicReport["status"], string> = {
  draft: "작성 중",
  patch_pending: "변경안 검토 필요",
  approved: "승인 완료",
  sent: "발송 기록 완료",
  stale: "최신 기준으로 다시 확인 필요",
};

const sectionLabels: Record<keyof ReportSections, string> = {
  key_issue: "핵심 이슈",
  changes_since_last_report: "지난 보고 이후 변경 사항",
  activity_summary: "문의·제안·방문 현황",
  negotiated_area_floor_changes: "협의 중인 면적·층 변경",
  competitor_buildings: "경쟁 빌딩",
  blocker_and_pending_approval: "확인 및 승인 필요 사항",
  next_actions: "다음 업무",
};

const reportTextLabels: Record<string, string> = {
  "5F marketed area and floor plan revised after partial occupancy.": "일부 입주 후 5층 임대 면적과 평면도가 변경되었습니다.",
  "Marketed area 300 py → 200 py": "임대 면적 300평 → 200평",
  "Floor plan v1 → v2": "평면도 버전 1 → 버전 2",
  "Rent-free 3 months → 2 months": "렌트프리 3개월 → 2개월",
  "Supported parking 3 → 2": "지원 주차 3대 → 2대",
  "Broker requested current 5F package": "중개사가 현재 5층 자료를 요청했습니다.",
  "Revised package prepared after publication": "게시 후 변경된 현장 자료를 준비했습니다.",
  "None after senior publication": "선임 게시 후 남은 차단 사항이 없습니다.",
  "Confirm broker feedback on Monday": "월요일에 중개사 의견을 확인합니다.",
  "LM Manager": "임대 관리 책임자",
  "No source-backed competitor building was identified.": "확인한 자료에서 경쟁 빌딩 언급을 찾지 못했습니다.",
  "No external-reportable competitor evidence is available.": "외부 보고에 사용할 수 있는 경쟁 빌딩 근거가 없습니다.",
};

function reportText(value: string) {
  if (reportTextLabels[value]) return reportTextLabels[value];
  if (/^[\x00-\x7F]+$/.test(value)) return "확인한 원문을 한국어로 표시할 수 없습니다. 근거 자료를 직접 확인해 주세요.";
  return value;
}

function reportValue(value: unknown): string {
  if (typeof value === "string") return reportText(value);
  if (typeof value === "number") return new Intl.NumberFormat("ko-KR").format(value);
  if (Array.isArray(value)) return value.length ? value.map(reportValue).join(" · ") : "내용 없음";
  if (value && typeof value === "object") {
    const item = value as { action?: unknown; owner?: unknown; due_date?: unknown };
    if (typeof item.action === "string") {
      return `${reportText(item.action)} · ${typeof item.owner === "string" ? reportText(item.owner) : "담당자 확인 필요"} · ${typeof item.due_date === "string" ? formatDate(item.due_date) : "기한 확인 필요"}`;
    }
    return "구조화된 변경 내용은 화면에서 안전하게 표시할 수 없습니다.";
  }
  return "내용 없음";
}

function reportSectionLabel(section: string): string {
  return isReportSectionKey(section) ? sectionLabels[section] : "보고 항목";
}

function isReportSectionKey(section: string): section is keyof ReportSections {
  return Object.prototype.hasOwnProperty.call(sectionLabels, section);
}

function reportSourceLabel(sourceType: string): string {
  if (sourceType === "activity" || sourceType === "leaseflow_activity") return "업무 기록";
  if (sourceType.includes("outlook")) return "이메일 자료";
  return "확인 자료";
}

function reportMutationBusyAction(
  action: ReportMutationAction,
  decision?: "accept" | "reject",
): BusyAction | null {
  if (action !== "decide_patch") return action;
  if (decision === "accept") return "patch-accept";
  if (decision === "reject") return "patch-reject";
  return null;
}

function reportMutationSuccessMessage(
  action: ReportMutationAction,
  decision?: "accept" | "reject",
): string {
  switch (action) {
    case "draft":
      return "현재 게시 정보를 기준으로 건물별 보고 초안을 만들었습니다.";
    case "investigate":
      return "저장된 이메일 자료에서 변경 후보를 준비했습니다. 근거와 비교해 주세요.";
    case "decide_patch":
      return decision === "accept"
        ? "변경안을 보고 초안에 반영했습니다."
        : "기존 보고 내용을 유지했습니다.";
    case "approve":
      return "담당자 승인을 완료했습니다. 이제 전달 기록을 남길 수 있습니다.";
    case "send":
      return "발송 기록을 저장했습니다. 실제 이메일은 전송하지 않았습니다.";
  }
}

function reportNextStep(status: PublicReport["status"]): string {
  if (status === "draft") return "내용 확인과 승인";
  if (status === "approved") return "발송 기록";
  return "처리 결과 확인";
}

export function ReportConsole({ reportRef }: { reportRef?: string }) {
  const { actorId, reload, reportError, reportWorkflow: workflow, workflow: adminWorkflow } = useAdminData();
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const allowedActions = new Set(workflow?.allowedActions ?? []);

  async function mutate(action: ReportMutationAction, decision?: "accept" | "reject") {
    if (!workflow || busy) return;
    const report = selectReportByRef(workflow.reports, reportRef);
    const busyKey = reportMutationBusyAction(action, decision);
    if (!busyKey) return;
    setBusy(busyKey);
    setNotice(null);
    try {
      const buildingId = adminWorkflow?.state.publication_scope.building_id;
      const body = buildReportMutationBody({
        action,
        actorId,
        revision: workflow.revision,
        ...(action === "draft" && buildingId ? { buildingId } : {}),
        ...(report ? { reportId: report.id } : {}),
        ...(decision ? { decision } : {}),
      });
      const response = await fetch("/api/mobile/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error);
      await reload();
      setNotice({ tone: "success", message: reportMutationSuccessMessage(action, decision) });
    } catch (error) {
      setNotice({ tone: "error", message: safeWorkflowError(error, "승인된 보고서") });
    } finally {
      setBusy(null);
    }
  }

  if (!workflow || !adminWorkflow) return <><header className="lf-admin-page-header"><h1 tabIndex={-1}>임대인 보고</h1></header><section aria-labelledby="report-load-heading"><h2 id="report-load-heading">보고 업무</h2>{reportError ? <div className="lf-admin-feedback lf-admin-feedback--error" role="alert"><h3>보고 업무를 열 수 없습니다</h3><p>{reportError}</p><button className="lf-admin-button" onClick={() => void reload()} type="button">다시 시도</button></div> : <div className="lf-admin-skeleton" aria-busy="true"><span /><span /><span /></div>}</section></>;

  if (!reportRef) return <ReportQueue reports={workflow.reports} canDraft={workflow.publication_stage === "published"} canPrepare={allowedActions.has("draft")} busy={busy} mutate={mutate} notice={notice} />;
  const report = selectReportByRef(workflow.reports, reportRef);
  if (!report) return <><header className="lf-admin-page-header"><h1 tabIndex={-1}>임대인 보고서를 찾을 수 없습니다</h1></header><section aria-labelledby="missing-report-heading"><h2 id="missing-report-heading">보고 목록으로 돌아가기</h2><div className="lf-admin-feedback lf-admin-feedback--error" role="alert"><h3>선택한 보고서를 열 수 없습니다</h3><p>현재 데모에 등록된 보고서가 아닙니다. 목록을 다시 불러와 실제 보고서를 선택해 주세요.</p><Link className="lf-admin-button" href="/reports">임대인 보고 목록</Link></div></section></>;
  return <ReportDetail report={report} busy={busy} allowedActions={allowedActions} mutate={mutate} notice={notice} reload={reload} />;
}

function ReportQueue({ busy, canDraft, canPrepare, mutate, notice, reports }: { busy: BusyAction | null; canDraft: boolean; canPrepare: boolean; mutate: (action: "draft") => Promise<void>; notice: Notice | null; reports: PublicReport[] }) {
  return <><header className="lf-admin-page-header"><h1 tabIndex={-1}>임대인 보고</h1></header>{notice ? <ReportNotice notice={notice} /> : null}<section aria-labelledby="report-queue-heading"><div className="lf-admin-section-heading"><h2 id="report-queue-heading">준비할 보고</h2><span>{reports.length}건</span></div>{reports.length ? <ul className="lf-admin-queue">{reports.map((report) => <li key={report.id}><Link href={`/reports/${encodeURIComponent(report.id)}`}><div><h3>{report.building_label} 주간 보고</h3><p><time dateTime={report.reporting_period.from}>{formatDate(report.reporting_period.from)}</time>–<time dateTime={report.reporting_period.to}>{formatDate(report.reporting_period.to)}</time></p></div><dl><div><dt>상태</dt><dd>{reportStatusLabels[report.status]}</dd></div><div><dt>다음</dt><dd>{reportNextStep(report.status)}</dd></div></dl></Link></li>)}</ul> : <div className="lf-admin-feedback"><h3>{canDraft ? "보고 초안을 만들 준비가 되었습니다" : "게시된 운영 정보가 필요합니다"}</h3><p>{canDraft ? "현재 게시·활성·외부 공유 가능한 정보만 사용해 초안을 만듭니다." : "승인·게시를 마치기 전에는 외부 보고를 만들 수 없습니다."}</p>{canDraft && canPrepare ? <button className="lf-admin-button" disabled={busy !== null} onClick={() => void mutate("draft")} type="button">{busy ? "초안 만드는 중…" : "보고 초안 만들기"}</button> : canDraft ? <p className="lf-admin-permission">현재 역할은 보고를 읽을 수 있지만 초안을 만들 수 없습니다. 임대 관리 업무 역할이 필요합니다.</p> : <Link className="lf-admin-button" href="/publishing">승인·게시 확인</Link>}</div>}</section></>;
}

function ReportNotice({ notice }: { notice: Notice }) {
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => noticeRef.current?.focus(), [notice.message]);
  return <div ref={noticeRef} tabIndex={-1} className={`lf-admin-feedback lf-admin-feedback--${notice.tone}`} role={notice.tone === "error" ? "alert" : undefined} aria-live={notice.tone === "success" ? "polite" : undefined}><h3>{notice.tone === "success" ? "보고 상태가 변경되었습니다" : "보고 작업을 완료하지 못했습니다"}</h3><p>{notice.message}</p></div>;
}

export function ReportDetail({ allowedActions, busy, mutate, notice, reload, report }: { allowedActions: ReadonlySet<ReportWorkflow["allowedActions"][number]>; busy: BusyAction | null; mutate: (action: "approve" | "investigate" | "decide_patch" | "send", decision?: "accept" | "reject") => Promise<void>; notice: Notice | null; reload: () => Promise<void>; report: PublicReport }) {
  const canInvestigate = allowedActions.has("investigate") && report.status === "draft" && !report.pending_candidate && report.accepted_patch_count === 0;
  const canAccept = allowedActions.has("decide_patch") && report.status === "patch_pending" && report.pending_candidate !== null && report.pending_candidate.unresolved.length === 0;
  const canApprove = allowedActions.has("approve") && report.status === "draft" && !report.pending_candidate && report.accepted_patch_count > 0 && report.unresolved.length === 0;
  const canSend = allowedActions.has("send") && report.status === "approved";
  const canPrepare = allowedActions.has("investigate") || allowedActions.has("decide_patch");
  const isLmManager = allowedActions.has("approve") && allowedActions.has("send");
  return <><header className="lf-admin-page-header"><h1 tabIndex={-1}>{report.building_label} · 주간 보고</h1><p><time dateTime={report.reporting_period.from}>{formatDate(report.reporting_period.from)}</time>부터 <time dateTime={report.reporting_period.to}>{formatDate(report.reporting_period.to)}</time>까지</p></header>{notice ? <ReportNotice notice={notice} /> : null}
    {report.status === "stale" ? <div className="lf-admin-feedback lf-admin-feedback--warning" role="alert"><h3>최신 기준으로 다시 확인해야 합니다</h3><p>게시 정보 또는 수신자 구성이 바뀌어 이 초안을 승인·발송할 수 없습니다. 최신 상태를 불러와 변경 범위를 확인해 주세요.</p><button className="lf-admin-button" onClick={() => void reload()} type="button">최신 상태 불러오기</button></div> : null}
    <div className="lf-admin-review-grid" aria-busy={busy !== null}><div>
      <section className="lf-admin-surface" aria-labelledby="report-content-heading"><h2 id="report-content-heading">보고 내용</h2><div className="lf-admin-report-sections">{(Object.keys(sectionLabels) as Array<keyof ReportSections>).map((key) => <section key={key}><h3>{sectionLabels[key]}</h3><ReportSection value={report.sections[key]} /></section>)}</div></section>
      {report.pending_candidate ? <section className="lf-admin-surface lf-admin-evidence" aria-labelledby="report-patch-heading"><h2 id="report-patch-heading">근거와 변경 비교</h2><ul className="lf-admin-comparison">{report.pending_candidate.operations.map((operation, index) => <li key={`${operation.section}-${index}`}><h3>{reportSectionLabel(operation.section)}</h3><div><dl><div><dt>현재 내용</dt><dd>{reportValue(operation.before)}</dd></div><div><dt>제안 내용</dt><dd>{reportValue(operation.after)}</dd></div></dl><p>출처 {operation.source_reference_ids.length}곳에서 확인</p></div></li>)}</ul>{report.pending_candidate.unresolved.length ? <div className="lf-admin-feedback lf-admin-feedback--warning" role="alert"><h3>추가 확인이 필요합니다</h3><p>해결되지 않은 근거가 있어 변경안 반영을 차단했습니다. 원문을 직접 확인해 주세요.</p></div> : null}</section> : null}
      <section className="lf-admin-surface" aria-labelledby="report-delivery-heading"><h2 id="report-delivery-heading">수신자와 첨부</h2><dl className="lf-admin-facts"><div><dt>받는 사람</dt><dd>{report.recipients.to.map((item) => item.email).join(", ")}</dd></div><div><dt>참조</dt><dd>{report.recipients.cc.map((item) => item.email).join(", ")}</dd></div><div><dt>첨부</dt><dd>{report.attachments.map((item) => item.filename).join(", ") || "첨부 없음"}</dd></div></dl><p className="lf-admin-readonly">주간 보고 설정에 저장된 건물별 수신자입니다.</p></section>
      <section className="lf-admin-surface" aria-labelledby="report-source-heading"><h2 id="report-source-heading">확인한 자료</h2><ul className="lf-admin-file-list">{report.sources.map((source) => <li key={source.id}><h3>{reportSourceLabel(source.source_type)}</h3><p>{reportText(source.summary)}</p><time dateTime={source.occurred_at}>{formatDateTime(source.occurred_at)}</time></li>)}</ul></section>
    </div><aside className="lf-admin-decision" aria-labelledby="report-decision-heading"><h2 id="report-decision-heading">승인과 전달</h2><span className="lf-admin-status lf-admin-status--info">{reportStatusLabels[report.status]}</span><p>현재 단계의 한 행동만 실행할 수 있습니다. 모든 외부 결과에는 사람 승인이 필요합니다.</p>
      {canInvestigate ? <button className="lf-admin-button" disabled={busy !== null} onClick={() => void mutate("investigate")} type="button">{busy ? "자료 확인 중…" : "이메일 변동 확인"}</button> : canAccept ? <><button className="lf-admin-button" disabled={busy !== null} onClick={() => void mutate("decide_patch", "accept")} type="button">{busy ? "반영 중…" : "변경안 반영"}</button><button className="lf-admin-button lf-admin-button--secondary" disabled={busy !== null} onClick={() => void mutate("decide_patch", "reject")} type="button">기존 내용 유지</button></> : canApprove ? <button className="lf-admin-button" disabled={busy !== null} onClick={() => void mutate("approve")} type="button">{busy ? "승인 중…" : "보고서 승인"}</button> : canSend ? <button className="lf-admin-button" disabled={busy !== null} onClick={() => void mutate("send")} type="button">{busy ? "기록 중…" : "확인하고 발송 기록 남기기"}</button> : <p className="lf-admin-handoff">다음: {report.status === "sent" ? "발송·감사 기록에서 완료 확인" : report.status === "stale" ? "최신 기준 확인" : "현재 검토 조건 충족 대기"}</p>}
      {((report.status === "draft" && report.accepted_patch_count > 0) || report.status === "approved") && !isLmManager
        ? <p className="lf-admin-permission">보고 승인과 발송 기록은 선택한 임대 관리 책임자 역할만 수행할 수 있습니다.</p>
        : !canPrepare ? <p className="lf-admin-permission">현재 역할은 보고를 읽을 수 있지만 초안·변경 결정을 저장할 수 없습니다. 임대 관리 업무 역할이 필요합니다.</p> : null}
      <p className="lf-admin-permission">데모에서는 실제 이메일을 보내지 않고 발송 기록만 남깁니다.</p>
    </aside></div></>;
}

function ReportSection({ value }: { value: string | string[] | ReportSections["next_actions"] }) {
  if (typeof value === "string") return <p>{reportText(value)}</p>;
  if (!value.length) return <p>이번 기간에 보고할 내용이 없습니다.</p>;
  return <ul>{value.map((item, index) => <li key={index}>{typeof item === "string" ? reportText(item) : <><strong>{reportText(item.action)}</strong><span>{reportText(item.owner)} · <time dateTime={item.due_date}>{formatDate(item.due_date)}</time>까지</span></>}</li>)}</ul>;
}
