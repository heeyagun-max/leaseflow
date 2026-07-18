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

type InvestigationCommand = (typeof INVESTIGATION_COMMANDS)[number];
type ReportStatus = ReportLifecycleStatus;

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
  key_issue: "Key issue",
  changes_since_last_report: "Changes since last report",
  activity_summary: "Inquiry / proposal / viewing activity",
  negotiated_area_floor_changes: "Negotiated area and floor changes",
  competitor_buildings: "Competitor buildings",
  blocker_and_pending_approval: "Blocker and pending approval",
  next_actions: "Next actions",
};

function stringifyDiffValue(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "No entries";
    return value.map((item) => {
      if (typeof item === "object" && item !== null) {
        const action = item as { action?: unknown; owner?: unknown; due_date?: unknown };
        if (action.action) return `${String(action.action)} · ${String(action.owner ?? "Unassigned")} · ${String(action.due_date ?? "No due date")}`;
      }
      return String(item);
    }).join("\n");
  }
  if (typeof value === "object" && value !== null) return JSON.stringify(value, null, 2);
  return String(value ?? "No value");
}

function statusTone(status: ReportStatus) {
  if (status === "approved" || status === "sent") return "success" as const;
  if (status === "stale") return "error" as const;
  if (status === "patch_pending") return "warning" as const;
  return "info" as const;
}

function ReportSection({ label, value }: { label: string; value: string | string[] | ReportSections["next_actions"] }) {
  return (
    <section className="lf-report-section">
      <h3>{label}</h3>
      {typeof value === "string" ? <p>{value}</p> : value.length === 0 ? (
        <p className="lf-empty-copy">No external-reportable entries.</p>
      ) : (
        <ul>{value.map((item) => (
          <li key={typeof item === "string" ? item : `${item.action}-${item.owner}-${item.due_date}`}>
            {typeof item === "string" ? item : <><strong>{item.action}</strong><span>{item.owner} · due {item.due_date}</span></>}
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
    if (!response.ok) throw new Error(result.error ?? "Unable to load the weekly report workflow.");
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
        draft: "A building-specific report draft was created from the current published snapshot.",
        investigate: "The command produced a source-backed patch candidate. Review its evidence before deciding.",
        decide_patch: options.decision === "accept" ? "The scoped patch was accepted into the draft." : "The candidate was rejected; report content is unchanged.",
        approve: "LM Manager approval recorded. The report is eligible for sandbox delivery.",
        send: "Sandbox delivery logged exactly once. No production email transport was used.",
      };
      setNotice({ severity: "success", message: messages[action] });
    } catch (error) {
      setNotice({ severity: "error", message: error instanceof Error ? error.message : "Unknown report workflow error." });
      await reload().catch(() => undefined);
    } finally {
      setBusyAction(null);
    }
  }

  if (!workflow) {
    return (
      <>
        <a className="lf-skip-link" href="#report-content">Skip to weekly report workspace</a>
        <div className="lf-product-shell">
          <AppNavigation current="reports" />
          <main id="report-content" className="lf-product-main">
            <FeedbackPanel tone={notice ? "error" : "loading"} title={notice ? "Reports unavailable" : "Loading weekly report state"}>
              {notice?.message ?? "Published materials, recipient configuration, and sandbox delivery state are being reconciled."}
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
      <a className="lf-skip-link" href="#report-content">Skip to weekly report workspace</a>
      <div className="lf-product-shell">
        <AppNavigation current="reports" />
        <main id="report-content" className="lf-product-main">
          <header className="lf-product-hero lf-product-hero--reports">
            <div className="lf-product-hero__copy">
              <p className="lf-eyebrow">Operations / Weekly landlord report</p>
              <h1>Investigate broadly. <span>Patch narrowly.</span></h1>
              <p>
                Five fixed Korean commands inspect synthetic activity and mock email. Each result remains a candidate until the LM Manager accepts its exact diff.
              </p>
            </div>
            <div className="lf-product-hero__meta">
              <StatusBadge tone="info">{workflow.labels.mode}</StatusBadge>
              <StatusBadge tone="warning">{workflow.labels.delivery}</StatusBadge>
              <span className="lf-data-label">REV {workflow.revision.toString().padStart(3, "0")}</span>
            </div>
          </header>

          {notice ? (
            <FeedbackPanel
              tone={notice.severity}
              title={notice.severity === "success" ? "Report state updated" : "Action blocked without mutation"}
              action={notice.severity === "error" ? <ActionButton variant="secondary" onClick={() => void reload()}>Reload current revision</ActionButton> : undefined}
            >
              {notice.message}
            </FeedbackPanel>
          ) : null}

          {!report ? (
            <section className="lf-product-section" aria-labelledby="prepare-report">
              <GovernanceSurface variant={canDraft ? "accent" : "default"}>
                <SectionHeading
                  eyebrow="01 / Prerequisite"
                  headingId="prepare-report"
                  title={canDraft ? "Published data is ready" : "Publication required"}
                  description={canDraft
                    ? "Create a building-specific draft from current, authorized, externally shareable synthetic records."
                    : "Complete source extraction, junior confirmation, and senior publication in Data governance first."}
                  action={canDraft
                    ? <ActionButton loading={busyAction === "draft"} onClick={() => void mutate("draft")} trailingIcon={<ArrowUpRightIcon />}>Create weekly report</ActionButton>
                    : <Link className="lf-button lf-button--secondary" href="/">Open data governance <span className="lf-button__island"><ArrowUpRightIcon /></span></Link>}
                />
                <dl className="lf-data-grid">
                  <DataFact label="Publication stage" value={workflow.publication_stage.replaceAll("_", " ")} detail="server-enforced prerequisite" state={canDraft ? "verified" : "default"} />
                  <DataFact label="Operator role" value={workflow.labels.role} detail="configured building access" />
                  <DataFact label="Delivery mode" value={workflow.labels.delivery} detail="no production transport" />
                </dl>
              </GovernanceSurface>
            </section>
          ) : (
            <>
              <section className="lf-product-section" aria-labelledby="report-progress">
                <SectionHeading
                  eyebrow="01 / Workflow"
                  headingId="report-progress"
                  title="Human-approved report lifecycle"
                  description={`${report.building_id} · ${report.reporting_period.from} — ${report.reporting_period.to} · ${workflow.labels.role}`}
                  action={<StatusBadge tone={statusTone(report.status)}>{report.status.replaceAll("_", " ")}</StatusBadge>}
                />
                <GovernanceSurface variant={report.status === "sent" ? "accent" : "default"}>
                  <ol className="lf-workflow">
                    <WorkflowStep index={1} state={reportLifecycleStepState(reportProgress!, "draft")} title="Draft">Published facts only</WorkflowStep>
                    <WorkflowStep index={2} state={reportLifecycleStepState(reportProgress!, "investigate")} title="Investigate">Candidate patch and evidence</WorkflowStep>
                    <WorkflowStep index={3} state={reportLifecycleStepState(reportProgress!, "approve")} title="LM approval">Recipients and report reviewed</WorkflowStep>
                    <WorkflowStep index={4} state={reportLifecycleStepState(reportProgress!, "send")} title="Sandbox delivery">Exactly-once activity log</WorkflowStep>
                  </ol>
                  {report.status === "stale" ? (
                    <div className="lf-inline-feedback" role="alert">
                      <strong>Stale report blocked</strong>
                      <span>Source, recipient, or published material drift was detected. Reset the synthetic demo and create a fresh draft.</span>
                    </div>
                  ) : null}
                </GovernanceSurface>
              </section>

              <div className="lf-product-grid lf-product-grid--reports">
                <section aria-labelledby="report-document">
                  <GovernanceSurface>
                    <SectionHeading
                      eyebrow="02 / External document"
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
                      <div><span className="lf-data-label">Approved attachment</span><strong>{report.attachments[0]?.filename ?? "No attachment"}</strong></div>
                      <code>{report.attachments[0]?.version_id ?? "none"}</code>
                    </div>
                  </GovernanceSurface>
                </section>

                <aside className="lf-product-rail" aria-labelledby="report-controls">
                  <GovernanceSurface variant="subtle">
                    <SectionHeading
                      eyebrow="03 / Command surface"
                      headingId="report-controls"
                      level={2}
                      variant="compact"
                      title="Run a fixed investigation"
                      description="Commands are exact allowlisted instructions. They cannot silently rewrite official property data."
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
                          <strong>{command}</strong>
                          {busyAction === `investigate:${command}` ? <em>Investigating…</em> : null}
                        </button>
                      ))}
                    </div>
                    <p className="lf-support-copy">
                      Data sources: LeaseFlow synthetic activity plus external-reportable mock Outlook fixtures. Client-confidential mail is excluded server-side.
                    </p>
                  </GovernanceSurface>
                </aside>
              </div>

              {report.pending_candidate ? (
                <section className="lf-product-section" aria-labelledby="patch-review">
                  <SectionHeading
                    eyebrow="04 / Candidate review"
                    headingId="patch-review"
                    title="Evidence before decision"
                    description={report.pending_candidate.command}
                    action={<StatusBadge tone="warning">Patch pending</StatusBadge>}
                  />
                  <GovernanceSurface>
                    <div className="lf-patch-review">
                      <div className="lf-finding-list">
                        <h3>Findings</h3>
                        {report.pending_candidate.findings.map((finding) => (
                          <article key={`${finding.finding}-${finding.source_reference_ids.join("-")}`}>
                            <span className="lf-confidence" aria-label={`${Math.round(finding.confidence * 100)} percent confidence`}>
                              {Math.round(finding.confidence * 100)}%
                            </span>
                            <div><strong>{finding.finding}</strong><code>{finding.source_reference_ids.join(" · ")}</code></div>
                          </article>
                        ))}
                      </div>
                      <div className="lf-operation-list">
                        <h3>Scoped operations</h3>
                        {report.pending_candidate.operations.map((operation) => (
                          <article key={`${operation.section}-${operation.operation}-${operation.source_reference_ids.join("-")}`}>
                            <header>
                              <div><span className="lf-data-label">{operation.operation}</span><strong>{sectionLabels[operation.section as keyof ReportSections] ?? operation.section}</strong></div>
                              <code>{operation.source_reference_ids.join(" · ")}</code>
                            </header>
                            <div className="lf-operation-diff">
                              <div><span>Before</span><pre>{stringifyDiffValue(operation.before)}</pre></div>
                              <div><span>After</span><pre>{stringifyDiffValue(operation.after)}</pre></div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                    {report.pending_candidate.unresolved.length > 0 ? (
                      <div className="lf-inline-feedback" role="alert">
                        <strong>Unresolved questions</strong>
                        <span>{report.pending_candidate.unresolved.map((item) => item.question).join(" · ")}</span>
                      </div>
                    ) : null}
                    <div className="lf-decision-bar">
                      <div><strong>Content changes only after an explicit decision.</strong><span>Reject preserves the current draft exactly.</span></div>
                      <div className="lf-cluster">
                        <ActionButton loading={busyAction === "patch:reject"} onClick={() => void mutate("decide_patch", { decision: "reject" })} variant="danger">Reject patch</ActionButton>
                        <ActionButton disabled={report.pending_candidate.unresolved.length > 0} loading={busyAction === "patch:accept"} onClick={() => void mutate("decide_patch", { decision: "accept" })}>Accept scoped patch</ActionButton>
                      </div>
                    </div>
                  </GovernanceSurface>
                </section>
              ) : null}

              <section className="lf-product-section" aria-labelledby="delivery-review">
                <SectionHeading
                  eyebrow="05 / Approval & delivery"
                  headingId="delivery-review"
                  title="Configured audience, human gate"
                  description="Recipient groups are loaded from deterministic building configuration, never model invention."
                />
                <div className="lf-product-grid lf-product-grid--delivery">
                  <GovernanceSurface>
                    <div className="lf-recipient-panel">
                      <div>
                        <span className="lf-data-label">To / practical owner</span>
                        {report.recipients.to.map((recipient) => <strong key={recipient.email}>{recipient.email}</strong>)}
                      </div>
                      <div>
                        <span className="lf-data-label">Cc / configured group</span>
                        <ul>{report.recipients.cc.map((recipient) => <li key={recipient.email}>{recipient.email}<span>{recipient.role.replaceAll("_", " ")}</span></li>)}</ul>
                      </div>
                      <code>{report.recipients.configuration_id}</code>
                    </div>
                  </GovernanceSurface>
                  <GovernanceSurface variant={report.status === "approved" || report.status === "sent" ? "accent" : "subtle"}>
                    <div className="lf-approval-panel">
                      <div className="lf-cluster">
                        <StatusBadge tone={report.approval.approved ? "success" : "neutral"}>{report.approval.approved ? "LM Manager approved" : "Approval required"}</StatusBadge>
                        <StatusBadge tone={report.delivery.sent ? "success" : "warning"}>{report.delivery.sent ? "Sandbox logged" : workflow.labels.delivery}</StatusBadge>
                      </div>
                      <h3>External report control</h3>
                      <p>{report.cover.body}</p>
                      <dl className="lf-data-grid lf-data-grid--rail">
                        <DataFact label="Accepted patches" value={report.accepted_patch_count} detail="replayable history" />
                        <DataFact label="Source references" value={report.sources.length} detail={report.sources.map((source) => source.id).join(" · ")} />
                      </dl>
                      <div className="lf-action-stack">
                        <ActionButton
                          disabled={report.status !== "draft" || report.unresolved.length > 0 || report.pending_candidate !== null}
                          loading={busyAction === "approve"}
                          onClick={() => void mutate("approve")}
                        >
                          Approve as LM Manager
                        </ActionButton>
                        <ActionButton
                          disabled={report.status !== "approved"}
                          loading={busyAction === "send"}
                          onClick={() => void mutate("send")}
                          trailingIcon={<ArrowUpRightIcon />}
                          variant="secondary"
                        >
                          Log sandbox delivery
                        </ActionButton>
                      </div>
                      <p className="lf-support-copy">No production Outlook, SMTP, carrier, or SSO integration is present or claimed.</p>
                    </div>
                  </GovernanceSurface>
                </div>
              </section>

              <section className="lf-product-section" aria-labelledby="report-provenance">
                <SectionHeading eyebrow="06 / Provenance" headingId="report-provenance" title="External-reportable sources only" description="Every included source is building-scoped; confidential fixture mail never enters this projection." />
                <GovernanceSurface variant="subtle">
                  <div className="lf-source-list">
                    {report.sources.map((source) => (
                      <article key={source.id}>
                        <div><span className="lf-data-label">{source.source_type.replaceAll("_", " ")}</span><strong>{source.summary}</strong></div>
                        <div><code>{source.id}</code><time dateTime={source.occurred_at}>{source.occurred_at}</time></div>
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
