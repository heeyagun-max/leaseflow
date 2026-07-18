"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ActionButton,
  ArrowUpRightIcon,
  DataFact,
  FeedbackPanel,
  GovernanceSurface,
  SectionHeading,
  StatusBadge,
  WorkflowStep,
} from "@/components/ui";
import { AppNavigation } from "@/components/governance/app-navigation";
import {
  reportLifecycleStepState,
  type ReportLifecycleStatus,
} from "./report-progress";

const INVESTIGATION_COMMANDS = [
  "통화내용 확인해서 이번주 변동사항 업데이트 해",
  "이메일 확인해서 이번주 변동사항 업데이트 해",
  "협의 중인 면적 변동 있는지 확인해",
  "협의 중인 층 변동 있는지 확인해",
  "메일이랑 전화 확인해서 경쟁빌딩 파악해봐",
] as const;

const investigationCommandLabels: Record<(typeof INVESTIGATION_COMMANDS)[number], string> = {
  "통화내용 확인해서 이번주 변동사항 업데이트 해": "이번 주 통화 변동 확인",
  "이메일 확인해서 이번주 변동사항 업데이트 해": "이번 주 이메일 변동 확인",
  "협의 중인 면적 변동 있는지 확인해": "협의 면적 변동 확인",
  "협의 중인 층 변동 있는지 확인해": "협의 층 변동 확인",
  "메일이랑 전화 확인해서 경쟁빌딩 파악해봐": "경쟁 빌딩 언급 확인",
};

const recipientRoleLabels: Record<string, string> = {
  asset_manager: "자산 관리",
  leasing_manager: "임대 관리",
  landlord: "소유주",
  property_manager: "시설 관리",
  to_landlord_practical: "소유주 실무 담당",
  cc_landlord_team: "소유주 팀",
  cc_landlord_exec: "소유주 책임자",
  cc_lm_team: "임대 관리팀",
  cc_lm_exec: "임대 관리 책임자",
};

type InvestigationCommand = (typeof INVESTIGATION_COMMANDS)[number];
type ReportStatus = ReportLifecycleStatus;

function investigationCommandLabel(command: string) {
  return investigationCommandLabels[command as InvestigationCommand] ?? "선택한 변동 확인";
}

function recipientRoleLabel(role: string) {
  return recipientRoleLabels[role] ?? "업무 담당자";
}

function friendlyReportSentence(value: string) {
  const sentences: Record<string, string> = {
    "No source-backed competitor building was identified.": "확인한 자료에서 경쟁 빌딩 언급을 찾지 못했습니다.",
    "No external-reportable competitor evidence is available.": "현재 확인 가능한 자료에 경쟁 빌딩 언급이 없습니다.",
  };
  return sentences[value] ?? value;
}

interface ReportSections {
  key_issue: string;
  changes_since_last_report: string[];
  activity_summary: string[];
  negotiated_area_floor_changes: string[];
  competitor_buildings: string[];
  blocker_and_pending_approval: string[];
  next_actions: Array<{ action: string; owner: string; due_date: string }>;
}

interface ReportPatchCandidate {
  id: string;
  command: string;
  findings: Array<{ finding: string; source_reference_ids: string[]; confidence: number }>;
  operations: Array<{
    section: string;
    operation: string;
    before: unknown;
    after: unknown;
    source_reference_ids: string[];
  }>;
  unresolved: Array<{ field: string; question: string }>;
}

interface PublicReport {
  id: string;
  building_id: string;
  reporting_period: { from: string; to: string };
  status: ReportStatus;
  sections: ReportSections;
  sources: Array<{ id: string; source_type: string; occurred_at: string; summary: string }>;
  attachments: Array<{ filename: string; version_id: string }>;
  recipients: {
    configuration_id: string;
    to: Array<{ email: string; role: string }>;
    cc: Array<{ email: string; role: string }>;
  };
  cover: { subject: string; body: string };
  unresolved: string[];
  pending_candidate: ReportPatchCandidate | null;
  accepted_patch_count: number;
  approval: { approved: boolean; approved_at: string | null };
  delivery: { sent: boolean; sent_at: string | null };
}

interface ReportWorkflow {
  revision: number;
  publication_stage: string;
  reports: PublicReport[];
  activities: Array<{ event_type: "report.sent.sandbox"; report_id: string; building_id: string; occurred_at: string; summary: string }>;
  audit: Array<{ event_label: string; occurred_at: string }>;
  labels: { mode: "DEMO"; role: "LM Manager"; delivery: "SANDBOX ONLY" };
}

type ReportAction = "approve" | "draft" | "send" | `investigate:${InvestigationCommand}` | "patch:accept" | "patch:reject";
type Notice = { message: string; severity: "error" | "success" };

const sectionLabels: Record<keyof ReportSections, string> = {
  key_issue: "핵심 이슈",
  changes_since_last_report: "지난 보고 이후 변경 사항",
  activity_summary: "문의·제안·방문 현황",
  negotiated_area_floor_changes: "협의 중인 면적·층 변경",
  competitor_buildings: "경쟁 빌딩",
  blocker_and_pending_approval: "확인 및 승인 필요 사항",
  next_actions: "다음 업무",
};

const reportStatusLabels: Record<ReportStatus, string> = {
  draft: "작성 중",
  patch_pending: "변경안 검토 중",
  approved: "승인 완료",
  sent: "전달 완료",
  stale: "다시 작성 필요",
};

const sourceTypeLabels: Record<string, string> = {
  activity: "업무 기록",
  call_fixture: "통화 메모",
  email_fixture: "이메일 자료",
};

function stringifyDiffValue(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "내용 없음";
    return value.map((item) => {
      if (typeof item === "object" && item !== null) {
        const action = item as { action?: unknown; owner?: unknown; due_date?: unknown };
        if (action.action) return `${String(action.action)} · ${String(action.owner ?? "담당자 미정")} · ${String(action.due_date ?? "기한 미정")}`;
      }
      return String(item);
    }).join("\n");
  }
  if (typeof value === "object" && value !== null) return JSON.stringify(value, null, 2);
  return String(value ?? "내용 없음");
}

function statusTone(status: ReportStatus) {
  if (status === "approved" || status === "sent") return "success" as const;
  if (status === "stale") return "error" as const;
  if (status === "patch_pending") return "warning" as const;
  return "info" as const;
}

function friendlyReportError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/revision|conflict|stale/i.test(message)) {
    return "다른 작업에서 보고서가 먼저 변경되었습니다. 최신 내용을 불러온 뒤 다시 진행해 주세요.";
  }
  if (/role|allowed|permission|forbidden/i.test(message)) {
    return "현재 담당자는 이 작업을 할 수 없습니다.";
  }
  return "작업을 완료하지 못했습니다. 보고서 상태를 확인한 뒤 다시 시도해 주세요.";
}

function ReportSection({ label, value }: { label: string; value: string | string[] | ReportSections["next_actions"] }) {
  return (
    <section className="lf-report-section">
      <h3>{label}</h3>
      {typeof value === "string" ? <p>{value}</p> : value.length === 0 ? (
        <p className="lf-empty-copy">이번 주에 보고할 내용이 없습니다.</p>
      ) : (
        <ul>{value.map((item) => (
          <li key={typeof item === "string" ? item : `${item.action}-${item.owner}-${item.due_date}`}>
            {typeof item === "string" ? item : <><strong>{item.action}</strong><span>{item.owner} · {item.due_date}까지</span></>}
          </li>
        ))}</ul>
      )}
    </section>
  );
}

export function ReportConsole() {
  const [workflow, setWorkflow] = useState<ReportWorkflow | null>(null);
  const [busyAction, setBusyAction] = useState<ReportAction | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const reload = useCallback(async () => {
    const response = await fetch("/api/mobile/reports", { cache: "no-store" });
    const result = await response.json() as ReportWorkflow & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "주간 보고서를 불러오지 못했습니다.");
    setWorkflow(result);
  }, []);

  useEffect(() => {
    void reload().catch((error: Error) => setNotice({ severity: "error", message: error.message }));
  }, [reload]);

  async function mutate(
    action: "approve" | "draft" | "send" | "investigate" | "decide_patch",
    options: { command?: InvestigationCommand; decision?: "accept" | "reject" } = {},
  ) {
    if (!workflow) return;
    const report = workflow.reports[0];
    const actionKey: ReportAction = action === "investigate"
      ? `investigate:${options.command!}`
      : action === "decide_patch"
        ? `patch:${options.decision!}`
        : action;
    setBusyAction(actionKey);
    setNotice(null);
    try {
      const body: Record<string, unknown> = {
        action,
        actor_id: "usr-manager",
        expected_revision: workflow.revision,
      };
      if (action !== "draft") body.report_id = report?.id;
      if (options.command) body.command = options.command;
      if (options.decision) body.decision = options.decision;
      if (action === "send" && report) body.idempotency_key = `sandbox-${report.id}-delivery`;
      const response = await fetch("/api/mobile/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as ReportWorkflow & { error?: string };
      if (!response.ok) throw new Error(result.error ?? `${action} failed.`);
      setWorkflow(result);
      const messages = {
        draft: "현재 자산 정보를 기준으로 주간 보고서 초안을 만들었습니다.",
        investigate: "확인 결과를 변경안으로 준비했습니다. 근거를 확인한 뒤 반영 여부를 결정해 주세요.",
        decide_patch: options.decision === "accept" ? "선택한 변경안을 보고서에 반영했습니다." : "변경안을 반영하지 않았습니다. 기존 보고서는 그대로 유지됩니다.",
        approve: "보고서 승인을 마쳤습니다. 이제 발송 기록을 남길 수 있습니다.",
        send: "발송 기록을 저장했습니다. 실제 이메일은 전송되지 않았습니다.",
      };
      setNotice({ severity: "success", message: messages[action] });
    } catch (error) {
      setNotice({ severity: "error", message: friendlyReportError(error) });
      await reload().catch(() => undefined);
    } finally {
      setBusyAction(null);
    }
  }

  if (!workflow) {
    return (
      <>
        <a className="lf-skip-link" href="#report-content">주간 보고서로 바로가기</a>
        <div className="lf-product-shell">
          <AppNavigation current="reports" />
          <main id="report-content" className="lf-product-main">
            <FeedbackPanel tone={notice ? "error" : "loading"} title={notice ? "보고서를 열 수 없습니다" : "주간 보고서를 불러오는 중"}>
              {notice?.message ?? "잠시만 기다려 주세요."}
            </FeedbackPanel>
          </main>
        </div>
      </>
    );
  }

  const report = workflow.reports[0];
  const canDraft = workflow.publication_stage === "published" && !report;
  const reportProgress = report ? {
    acceptedPatchCount: report.accepted_patch_count,
    hasPendingCandidate: report.pending_candidate !== null,
    status: report.status,
  } : null;

  return (
    <>
      <a className="lf-skip-link" href="#report-content">주간 보고서로 바로가기</a>
      <div className="lf-product-shell">
        <AppNavigation current="reports" />
        <main id="report-content" className="lf-product-main">
          <header className="lf-product-hero lf-product-hero--reports">
            <div className="lf-product-hero__copy">
              <p className="lf-eyebrow">주간 보고서</p>
              <h1>이번 주 변동을 확인하고 <span>보고서를 완성하세요.</span></h1>
              <p>저장된 업무 기록을 살펴보고, 필요한 변경만 검토한 뒤 승인합니다.</p>
            </div>
            <div className="lf-product-hero__meta"><StatusBadge tone="info">보고 준비</StatusBadge></div>
          </header>

          {notice ? (
            <FeedbackPanel
              tone={notice.severity}
              title={notice.severity === "success" ? "보고서를 업데이트했습니다" : "작업을 완료하지 못했습니다"}
              action={notice.severity === "error" ? <ActionButton variant="secondary" onClick={() => void reload()}>최신 내용 다시 불러오기</ActionButton> : undefined}
            >
              {notice.message}
            </FeedbackPanel>
          ) : null}

          {!report ? (
            <section className="lf-product-section" aria-labelledby="prepare-report">
              <GovernanceSurface variant={canDraft ? "accent" : "default"}>
                <SectionHeading
                  eyebrow="시작하기"
                  headingId="prepare-report"
                  title={canDraft ? "보고서를 만들 준비가 되었습니다" : "자산 정보 게시가 필요합니다"}
                  description={canDraft
                    ? "현재 자산 정보를 기준으로 이번 주 보고서 초안을 만듭니다."
                    : "자산 정보에서 변경안을 확인하고 최종 게시까지 마쳐 주세요."}
                  action={canDraft
                    ? <ActionButton loading={busyAction === "draft"} onClick={() => void mutate("draft")} trailingIcon={<ArrowUpRightIcon />}>주간 보고서 만들기</ActionButton>
                    : <Link className="lf-button lf-button--secondary" href="/">자산 정보 열기 <span className="lf-button__island"><ArrowUpRightIcon /></span></Link>}
                />
                <dl className="lf-data-grid">
                  <DataFact label="자산 정보" value={canDraft ? "게시 완료" : "게시 전"} detail="보고서 기준 정보" state={canDraft ? "verified" : "default"} />
                  <DataFact label="담당자" value="임대 관리자" detail="Cobalt Finance Center" />
                  <DataFact label="전달 방식" value="발송 기록" detail="실제 이메일은 전송되지 않습니다" />
                </dl>
              </GovernanceSurface>
            </section>
          ) : (
            <>
              <section className="lf-product-section" aria-labelledby="report-progress">
                <SectionHeading
                  eyebrow="진행 상황"
                  headingId="report-progress"
                  title="보고서 작성부터 전달까지"
                  description={`Cobalt Finance Center · ${report.reporting_period.from} — ${report.reporting_period.to}`}
                  action={<StatusBadge tone={statusTone(report.status)}>{reportStatusLabels[report.status]}</StatusBadge>}
                />
                <GovernanceSurface variant={report.status === "sent" ? "accent" : "default"}>
                  <ol className="lf-workflow">
                    <WorkflowStep index={1} state={reportLifecycleStepState(reportProgress!, "draft")} title="초안 작성">현재 자산 정보</WorkflowStep>
                    <WorkflowStep index={2} state={reportLifecycleStepState(reportProgress!, "investigate")} title="변동 확인">업무 기록 검토</WorkflowStep>
                    <WorkflowStep index={3} state={reportLifecycleStepState(reportProgress!, "approve")} title="최종 승인">내용과 수신자 확인</WorkflowStep>
                    <WorkflowStep index={4} state={reportLifecycleStepState(reportProgress!, "send")} title="전달">발송 기록</WorkflowStep>
                  </ol>
                  {report.status === "stale" ? (
                    <div className="lf-inline-feedback" role="alert">
                      <strong>보고서를 다시 만들어야 합니다</strong>
                      <span>기준 정보나 수신자가 변경되었습니다. 최신 내용으로 새 초안을 만들어 주세요.</span>
                    </div>
                  ) : null}
                </GovernanceSurface>
              </section>

              <div className="lf-product-grid lf-product-grid--reports">
                <section aria-labelledby="report-document">
                  <GovernanceSurface>
                    <SectionHeading
                      eyebrow="보고서 미리보기"
                      headingId="report-document"
                      title="Cobalt Finance Center"
                      description={report.cover.subject}
                    />
                    <div className="lf-report-document">
                      {(Object.keys(sectionLabels) as Array<keyof ReportSections>).map((key) => (
                        <ReportSection key={key} label={sectionLabels[key]} value={report.sections[key]} />
                      ))}
                    </div>
                    <div className="lf-attachment-row">
                      <div><span className="lf-data-label">첨부 파일</span><strong>{report.attachments[0]?.filename ?? "첨부 없음"}</strong></div>
                      <span>승인된 최신 파일</span>
                    </div>
                  </GovernanceSurface>
                </section>

                <aside className="lf-product-rail" aria-labelledby="report-controls">
                  <GovernanceSurface variant="subtle">
                    <SectionHeading
                      eyebrow="변동 확인"
                      headingId="report-controls"
                      level={2}
                      variant="compact"
                      title="저장된 업무 기록 확인"
                      description="확인할 항목을 선택하면 보고서 변경안을 준비합니다."
                    />
                    <div className="lf-command-list">
                      {INVESTIGATION_COMMANDS.map((command, index) => (
                        <button
                          className="lf-command"
                          disabled={busyAction !== null || report.status !== "draft"}
                          key={command}
                          onClick={() => void mutate("investigate", { command })}
                          type="button"
                        >
                          <span>{(index + 1).toString().padStart(2, "0")}</span>
                          <strong>{investigationCommandLabels[command]}</strong>
                          {busyAction === `investigate:${command}` ? <em>확인 중…</em> : null}
                        </button>
                      ))}
                    </div>
                    <p className="lf-support-copy">
                      저장된 이메일 자료와 업무 기록만 사용합니다. 비공개 메일은 결과에 포함되지 않습니다.
                    </p>
                  </GovernanceSurface>
                </aside>
              </div>

              {report.pending_candidate ? (
                <section className="lf-product-section" aria-labelledby="patch-review">
                  <SectionHeading
                    eyebrow="변경안 검토"
                    headingId="patch-review"
                    title="근거를 확인한 뒤 반영하세요"
                    description={investigationCommandLabel(report.pending_candidate.command)}
                    action={<StatusBadge tone="warning">확인 필요</StatusBadge>}
                  />
                  <GovernanceSurface>
                    <div className="lf-patch-review">
                      <div className="lf-finding-list">
                        <h3>확인 결과</h3>
                        {report.pending_candidate.findings.map((finding) => (
                          <article key={`${finding.finding}-${finding.source_reference_ids.join("-")}`}>
                            <span className="lf-confidence" aria-label={`자료 일치도 ${Math.round(finding.confidence * 100)}퍼센트`}>
                              {Math.round(finding.confidence * 100)}%
                            </span>
                            <div><strong>{friendlyReportSentence(finding.finding)}</strong><span>{finding.source_reference_ids.length}개 자료에서 확인</span></div>
                          </article>
                        ))}
                      </div>
                      <div className="lf-operation-list">
                        <h3>보고서 변경 내용</h3>
                        {report.pending_candidate.operations.map((operation) => (
                          <article key={`${operation.section}-${operation.operation}-${operation.source_reference_ids.join("-")}`}>
                            <header>
                              <div><span className="lf-data-label">제안 변경</span><strong>{sectionLabels[operation.section as keyof ReportSections] ?? operation.section}</strong></div>
                              <span>{operation.source_reference_ids.length}개 자료에서 확인</span>
                            </header>
                            <div className="lf-operation-diff">
                              <div><span>현재 내용</span><pre>{stringifyDiffValue(operation.before)}</pre></div>
                              <div><span>제안 내용</span><pre>{stringifyDiffValue(operation.after)}</pre></div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                    {report.pending_candidate.unresolved.length > 0 ? (
                      <div className="lf-inline-feedback" role="alert">
                        <strong>추가 확인이 필요합니다</strong>
                        <span>{report.pending_candidate.unresolved.map((item) => friendlyReportSentence(item.question)).join(" · ")}</span>
                      </div>
                    ) : null}
                    <div className="lf-decision-bar">
                      <div><strong>선택한 변경만 보고서에 반영됩니다.</strong><span>반영하지 않으면 기존 초안이 그대로 유지됩니다.</span></div>
                      <div className="lf-cluster">
                        <ActionButton loading={busyAction === "patch:reject"} onClick={() => void mutate("decide_patch", { decision: "reject" })} variant="ghost">반영하지 않기</ActionButton>
                        <ActionButton disabled={report.pending_candidate.unresolved.length > 0} loading={busyAction === "patch:accept"} onClick={() => void mutate("decide_patch", { decision: "accept" })}>변경안 반영하기</ActionButton>
                      </div>
                    </div>
                  </GovernanceSurface>
                </section>
              ) : null}

              <section className="lf-product-section" aria-labelledby="delivery-review">
                <SectionHeading
                  eyebrow="승인과 전달"
                  headingId="delivery-review"
                  title="수신자와 최종 내용 확인"
                  description="건물별로 등록된 수신자와 보고서 내용을 확인한 뒤 승인합니다."
                />
                <div className="lf-product-grid lf-product-grid--delivery">
                  <GovernanceSurface>
                    <div className="lf-recipient-panel">
                      <div>
                        <span className="lf-data-label">받는 사람</span>
                        {report.recipients.to.map((recipient) => <strong key={recipient.email}>{recipient.email}</strong>)}
                      </div>
                      <div>
                        <span className="lf-data-label">참조</span>
                        <ul>{report.recipients.cc.map((recipient) => <li key={recipient.email}>{recipient.email}<span>{recipientRoleLabel(recipient.role)}</span></li>)}</ul>
                      </div>
                      <span>등록된 보고 그룹</span>
                    </div>
                  </GovernanceSurface>
                  <GovernanceSurface variant={report.status === "approved" || report.status === "sent" ? "accent" : "subtle"}>
                    <div className="lf-approval-panel">
                      <div className="lf-cluster">
                        <StatusBadge tone={report.approval.approved ? "success" : "neutral"}>{report.approval.approved ? "승인 완료" : "승인 필요"}</StatusBadge>
                        <StatusBadge tone={report.delivery.sent ? "success" : "warning"}>{report.delivery.sent ? "전달 완료" : "전달 전"}</StatusBadge>
                      </div>
                      <h3>최종 보고서</h3>
                      <p>{report.cover.body}</p>
                      <dl className="lf-data-grid lf-data-grid--rail">
                        <DataFact label="반영한 변경" value={report.accepted_patch_count} detail="검토 완료" />
                        <DataFact label="확인한 자료" value={report.sources.length} detail="업무 기록과 이메일 자료" />
                      </dl>
                      <div className="lf-action-stack">
                        <ActionButton
                          disabled={report.status !== "draft" || report.unresolved.length > 0 || report.pending_candidate !== null}
                          loading={busyAction === "approve"}
                          onClick={() => void mutate("approve")}
                        >
                          보고서 승인하기
                        </ActionButton>
                        <ActionButton
                          disabled={report.status !== "approved"}
                          loading={busyAction === "send"}
                          onClick={() => void mutate("send")}
                          trailingIcon={<ArrowUpRightIcon />}
                          variant="secondary"
                        >
                          확인하고 발송 기록 남기기
                        </ActionButton>
                      </div>
                      <p className="lf-support-copy">발송 기록만 저장하며 실제 이메일·전화·로그인 연결은 사용하지 않습니다.</p>
                    </div>
                  </GovernanceSurface>
                </div>
              </section>

              <section className="lf-product-section" aria-labelledby="report-provenance">
                <SectionHeading eyebrow="확인 자료" headingId="report-provenance" title="보고서에 사용한 자료" description="이번 보고서에 반영된 업무 기록과 이메일 자료입니다." />
                <GovernanceSurface variant="subtle">
                  <div className="lf-source-list">
                    {report.sources.map((source) => (
                      <article key={source.id}>
                        <div><span className="lf-data-label">{sourceTypeLabels[source.source_type] ?? "업무 자료"}</span><strong>{source.summary}</strong></div>
                        <div>
                          <time dateTime={source.occurred_at}>{source.occurred_at}</time>
                        </div>
                      </article>
                    ))}
                  </div>
                </GovernanceSurface>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}
