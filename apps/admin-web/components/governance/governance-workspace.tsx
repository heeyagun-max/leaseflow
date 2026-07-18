"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DemoState } from "@leaseflow/demo-data";
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
import { AppNavigation } from "./app-navigation";

interface WorkflowResponse {
  state: DemoState;
  source: {
    id: string;
    buildingName: string;
    effectiveDate: string;
    title: string;
  };
  users: readonly { id: string; display_name: string; role: string }[];
  storage: string;
}

type MutationAction = "confirm" | "extract" | "publish" | "reset";
type Notice = { message: string; severity: "error" | "success" };

const stageOrder = ["source_uploaded", "extracted_candidate", "junior_confirmed", "published"] as const;

const stageLabels = {
  source_uploaded: "Source ready",
  extracted_candidate: "Candidates extracted",
  junior_confirmed: "Junior confirmed",
  senior_approved: "Senior approved",
  published: "Published",
} as const;

const fieldLabels = {
  marketed_area_py: "Marketed area",
  floor_plan: "Floor plan",
  rent_free_months: "Rent-free",
  supported_parking_spaces: "Supported parking",
} as const;

function workflowStepState(stage: DemoState["stage"], key: (typeof stageOrder)[number]) {
  const currentIndex = stage === "senior_approved" ? 3 : stageOrder.indexOf(stage as (typeof stageOrder)[number]);
  const stepIndex = stageOrder.indexOf(key);
  if (stepIndex < currentIndex || stage === "published") return "complete" as const;
  if (stepIndex === currentIndex) return "current" as const;
  return "pending" as const;
}

function formatValue(field: keyof typeof fieldLabels, value: unknown) {
  if (field === "marketed_area_py") return `${String(value)} py`;
  if (field === "rent_free_months") return `${String(value)} months`;
  if (field === "supported_parking_spaces") return `${String(value)} spaces`;
  return String(value);
}

function formatRole(role: string) {
  return role.split("_").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
}

export function GovernanceWorkspace() {
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [actorId, setActorId] = useState("usr-junior");
  const [busyAction, setBusyAction] = useState<MutationAction | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const reload = useCallback(async () => {
    const response = await fetch("/api/demo/workflow", { cache: "no-store" });
    const result = await response.json() as WorkflowResponse & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load the governed demo workflow.");
    setWorkflow(result);
  }, []);

  useEffect(() => {
    void reload().catch((error: Error) => setNotice({ message: error.message, severity: "error" }));
  }, [reload]);

  async function mutate(action: MutationAction) {
    if (!workflow) return;
    setBusyAction(action);
    setNotice(null);
    try {
      const response = await fetch(`/api/demo/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_id: actorId, expected_revision: workflow.state.revision }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? `${action} failed.`);
      await reload();
      const messages: Record<MutationAction, string> = {
        extract: "Four source-backed candidates are ready for Data Steward confirmation.",
        confirm: "Junior confirmation recorded. The batch now requires a Senior Reviewer.",
        publish: "Senior approval and publication completed. Mobile can read only the current v2 records.",
        reset: "Synthetic demo state, history, and report operations were reset.",
      };
      setNotice({ severity: "success", message: messages[action] });
    } catch (error) {
      setNotice({
        severity: "error",
        message: error instanceof Error ? error.message : "Unknown workflow error.",
      });
      await reload().catch(() => undefined);
    } finally {
      setBusyAction(null);
    }
  }

  const publishedRecords = useMemo(
    () => workflow?.state.records.filter((record) => record.status === "published") ?? [],
    [workflow],
  );

  if (!workflow) {
    return (
      <>
        <a className="lf-skip-link" href="#governance-content">Skip to governance workspace</a>
        <div className="lf-product-shell">
          <AppNavigation current="governance" />
          <main id="governance-content" className="lf-product-main">
            <FeedbackPanel tone={notice ? "error" : "loading"} title={notice ? "Workflow unavailable" : "Loading persistent demo state"}>
              {notice?.message ?? "Revision, source scope, and audit history are being reconciled."}
            </FeedbackPanel>
          </main>
        </div>
      </>
    );
  }

  const { source, state, users } = workflow;
  const actor = users.find((user) => user.id === actorId) ?? users[0]!;
  const stage = state.stage === "senior_approved" ? "published" : state.stage;

  return (
    <>
      <a className="lf-skip-link" href="#governance-content">Skip to governance workspace</a>
      <div className="lf-product-shell">
        <AppNavigation current="governance" />
        <main id="governance-content" className="lf-product-main">
          <header className="lf-product-hero">
            <div className="lf-product-hero__copy">
              <p className="lf-eyebrow">Data Admin / Source-to-publish</p>
              <h1>Turn source changes into <span>governed facts.</span></h1>
              <p>
                AI extraction creates candidates only. Junior confirmation and senior publication remain separate,
                server-authorized transitions with a durable audit trail.
              </p>
            </div>
            <div className="lf-product-hero__meta">
              <StatusBadge tone={state.stage === "published" ? "success" : "info"}>{stageLabels[state.stage]}</StatusBadge>
              <span className="lf-data-label">REV {state.revision.toString().padStart(3, "0")}</span>
            </div>
          </header>

          {notice ? (
            <FeedbackPanel
              tone={notice.severity}
              title={notice.severity === "success" ? "Governed state updated" : "Action blocked without mutation"}
              action={notice.severity === "error" ? <ActionButton variant="secondary" onClick={() => void reload()}>Reload current revision</ActionButton> : undefined}
            >
              {notice.message}
            </FeedbackPanel>
          ) : null}

          <section className="lf-product-section" aria-labelledby="publication-progress">
            <SectionHeading
              eyebrow="01 / Workflow"
              headingId="publication-progress"
              title="Publication control plane"
              description="The current stage, accountable role, and next permissible action remain visible together."
            />
            <GovernanceSurface variant={state.stage === "published" ? "accent" : "default"}>
              <ol className="lf-workflow">
                <WorkflowStep index={1} state={workflowStepState(stage, "source_uploaded")} title="Source selected">Synthetic July update</WorkflowStep>
                <WorkflowStep index={2} state={workflowStepState(stage, "extracted_candidate")} title="Extract candidates">Server-side structured output</WorkflowStep>
                <WorkflowStep index={3} state={workflowStepState(stage, "junior_confirmed")} title="Junior confirmation">Data Steward only</WorkflowStep>
                <WorkflowStep index={4} state={workflowStepState(stage, "published")} title="Senior publication">Reviewer-owned final gate</WorkflowStep>
              </ol>
            </GovernanceSurface>
          </section>

          <div className="lf-product-grid lf-product-grid--governance">
            <section aria-labelledby="source-review">
              <GovernanceSurface>
                <SectionHeading
                  eyebrow="02 / Evidence review"
                  headingId="source-review"
                  title={`${source.buildingName} · ${source.title}`}
                  description={`Source ${source.id} · effective ${source.effectiveDate} · scope ${state.publication_scope.floor}`}
                />

                {state.candidates.length === 0 ? (
                  <FeedbackPanel tone="empty" title="No extracted candidates">
                    Run extraction to create four reviewable changes. Official records remain untouched.
                  </FeedbackPanel>
                ) : (
                  <div className="lf-candidate-list" aria-label="Source-backed candidate changes">
                    {state.candidates.map((candidate) => (
                      <article className="lf-candidate" key={candidate.id}>
                        <div className="lf-candidate__heading">
                          <div>
                            <p className="lf-data-label">{candidate.floor} / {candidate.target_type}</p>
                            <h3>{fieldLabels[candidate.field]}</h3>
                          </div>
                          <StatusBadge tone={candidate.status === "published" ? "success" : "info"}>
                            {candidate.status.replaceAll("_", " ")}
                          </StatusBadge>
                        </div>
                        <div className="lf-candidate__diff">
                          <div><span>Previous</span><del>{formatValue(candidate.field, candidate.previous_value)}</del></div>
                          <div><span>Candidate</span><strong>{formatValue(candidate.field, candidate.proposed_value)}</strong></div>
                        </div>
                        <div className="lf-candidate__provenance">
                          <span>{candidate.source_pointer}</span>
                          <span>{Math.round(candidate.confidence * 100)}% confidence</span>
                          <code>{candidate.candidate_version_id}</code>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </GovernanceSurface>
            </section>

            <aside className="lf-product-rail" aria-labelledby="role-control">
              <GovernanceSurface variant="subtle">
                <SectionHeading
                  eyebrow="03 / Role boundary"
                  headingId="role-control"
                  level={2}
                  variant="compact"
                  title="Act as a demo role"
                  description="Scenario selection proves authorization; it is not authentication."
                />
                <label className="lf-field">
                  <span>Current actor</span>
                  <select value={actorId} onChange={(event) => setActorId(event.target.value)} disabled={busyAction !== null}>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.display_name} · {formatRole(user.role)}</option>
                    ))}
                  </select>
                </label>
                <dl className="lf-data-grid lf-data-grid--rail">
                  <DataFact label="Actor" value={actor.display_name} detail={formatRole(actor.role)} />
                  <DataFact label="Persistent revision" value={state.revision} detail="optimistic concurrency enabled" />
                </dl>
                <div className="lf-action-stack" aria-label="Publication actions">
                  <ActionButton
                    disabled={state.stage !== "source_uploaded"}
                    loading={busyAction === "extract"}
                    onClick={() => void mutate("extract")}
                    trailingIcon={<ArrowUpRightIcon />}
                  >
                    Extract four candidates
                  </ActionButton>
                  <ActionButton
                    disabled={state.stage !== "extracted_candidate"}
                    loading={busyAction === "confirm"}
                    onClick={() => void mutate("confirm")}
                    variant="secondary"
                  >
                    Confirm as Data Steward
                  </ActionButton>
                  <ActionButton
                    disabled={state.stage !== "junior_confirmed"}
                    loading={busyAction === "publish"}
                    onClick={() => void mutate("publish")}
                    variant="secondary"
                  >
                    Approve and publish
                  </ActionButton>
                </div>
                <p className="lf-support-copy">
                  Try publishing as Mina Lee to see the server reject the role without changing the revision or records.
                </p>
                <ActionButton loading={busyAction === "reset"} onClick={() => void mutate("reset")} variant="ghost">
                  Reset synthetic state
                </ActionButton>
              </GovernanceSurface>
            </aside>
          </div>

          <section className="lf-product-section" aria-labelledby="published-records">
            <SectionHeading
              eyebrow="04 / Version ledger"
              headingId="published-records"
              title="Current facts and retained history"
              description="Published predecessors remain traceable after supersession. Candidate files cannot enter the mobile adapter before publication."
              action={<Link className="lf-button lf-button--secondary" href="/mobile-preview">Open mobile preview <span className="lf-button__island"><ArrowUpRightIcon /></span></Link>}
            />
            <GovernanceSurface>
              <dl className="lf-data-grid">
                <DataFact label="Published records" value={publishedRecords.length} detail="current + retained predecessors" state={state.stage === "published" ? "verified" : "default"} />
                <DataFact label="File versions" value={state.files.length} detail="floor-plan registry" />
                <DataFact label="Audit events" value={state.audit.length} detail="immutable demo timeline" />
                <DataFact label="Storage adapter" value="Persistent JSON" detail={workflow.storage} />
              </dl>

              <div className="lf-ledger-grid">
                <div>
                  <h3>Record versions</h3>
                  <div className="lf-table-wrap" tabIndex={0} aria-label="Scrollable record version table">
                    <table className="lf-product-table">
                      <thead><tr><th>Version</th><th>Field</th><th>Status</th><th>Effective window</th></tr></thead>
                      <tbody>{state.records.map((record) => (
                        <tr key={record.id}>
                          <td><code>{record.id}</code></td>
                          <td>{fieldLabels[record.field]}</td>
                          <td><StatusBadge tone={record.status === "published" ? "success" : record.status === "superseded" ? "neutral" : "info"}>{record.status}</StatusBadge></td>
                          <td>{record.valid_from} → {record.valid_to ?? "current"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h3>Floor-plan versions</h3>
                  <div className="lf-version-list">
                    {state.files.map((file) => (
                      <article key={file.id}>
                        <div><strong>{file.filename}</strong><code>{file.id}</code></div>
                        <StatusBadge tone={file.status === "published" ? "success" : file.status === "superseded" ? "neutral" : "info"}>{file.status}</StatusBadge>
                        <span>v{file.version_no} · {file.valid_from} → {file.valid_to ?? "current"}</span>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </GovernanceSurface>
          </section>

          <section className="lf-product-section" aria-labelledby="audit-trail">
            <SectionHeading eyebrow="05 / Audit" headingId="audit-trail" title="Human decisions, in order" description="Every state mutation records actor, role, entity, and time." />
            <GovernanceSurface variant="subtle">
              {state.audit.length === 0 ? (
                <FeedbackPanel tone="empty" title="No mutations recorded">Extraction will create the first audit event.</FeedbackPanel>
              ) : (
                <ol className="lf-audit-list">
                  {[...state.audit].reverse().map((event) => (
                    <li key={event.id}>
                      <span className="lf-audit-list__mark" aria-hidden="true" />
                      <div><strong>{event.event_type.replaceAll(".", " ")}</strong><span>{event.actor_id} · {formatRole(event.actor_role)}</span></div>
                      <time dateTime={event.occurred_at}>{event.occurred_at}</time>
                    </li>
                  ))}
                </ol>
              )}
            </GovernanceSurface>
          </section>
        </main>
      </div>
    </>
  );
}
