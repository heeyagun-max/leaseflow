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
  source_uploaded: "자료 확인 전",
  extracted_candidate: "변경안 검토 중",
  junior_confirmed: "1차 확인 완료",
  senior_approved: "최종 확인 완료",
  published: "게시 완료",
} as const;

const fieldLabels = {
  marketed_area_py: "임대 면적",
  floor_plan: "평면도",
  rent_free_months: "렌트프리",
  supported_parking_spaces: "지원 주차",
} as const;

const recordStatusLabels = {
  candidate: "검토 중",
  published: "현재 사용",
  superseded: "이전 버전",
} as const;

const auditEventLabels: Record<string, string> = {
  "source.extracted": "변경안 추출",
  "candidate.confirmed": "1차 확인",
  "publication.completed": "최종 승인 및 게시",
};

function workflowStepState(stage: DemoState["stage"], key: (typeof stageOrder)[number]) {
  const currentIndex = stage === "senior_approved" ? 3 : stageOrder.indexOf(stage as (typeof stageOrder)[number]);
  const stepIndex = stageOrder.indexOf(key);
  if (stepIndex < currentIndex || stage === "published") return "complete" as const;
  if (stepIndex === currentIndex) return "current" as const;
  return "pending" as const;
}

function formatValue(field: keyof typeof fieldLabels, value: unknown) {
  if (field === "marketed_area_py") return `${String(value)}평`;
  if (field === "rent_free_months") return `${String(value)}개월`;
  if (field === "supported_parking_spaces") return `${String(value)}대`;
  return String(value);
}

function formatRole(role: string) {
  const labels: Record<string, string> = {
    data_steward: "데이터 담당자",
    senior_reviewer: "선임 담당자",
    lm_manager: "임대 관리자",
  };
  return labels[role] ?? "담당자";
}

function friendlyWorkflowError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/role|allowed|permission|forbidden/i.test(message)) {
    return "현재 담당자는 이 작업을 할 수 없습니다. 다음 단계 담당자를 선택해 주세요.";
  }
  if (/revision|conflict|stale/i.test(message)) {
    return "다른 작업에서 정보가 먼저 변경되었습니다. 최신 내용을 불러온 뒤 다시 진행해 주세요.";
  }
  return "작업을 완료하지 못했습니다. 현재 단계와 담당자를 확인한 뒤 다시 시도해 주세요.";
}

export function GovernanceWorkspace() {
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [actorId, setActorId] = useState("usr-junior");
  const [busyAction, setBusyAction] = useState<MutationAction | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const reload = useCallback(async () => {
    const response = await fetch("/api/demo/workflow", { cache: "no-store" });
    const result = await response.json() as WorkflowResponse & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "자산 정보 작업을 불러오지 못했습니다.");
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
        extract: "자료에서 변경안 4건을 찾았습니다. 내용을 확인해 주세요.",
        confirm: "1차 확인을 마쳤습니다. 이제 선임 담당자의 최종 확인이 필요합니다.",
        publish: "최종 승인과 게시를 마쳤습니다. 현장 앱에서 최신 정보를 확인할 수 있습니다.",
        reset: "데모를 처음 상태로 되돌렸습니다.",
      };
      setNotice({ severity: "success", message: messages[action] });
    } catch (error) {
      setNotice({
        severity: "error",
        message: friendlyWorkflowError(error),
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
        <a className="lf-skip-link" href="#governance-content">자산 정보로 바로가기</a>
        <div className="lf-product-shell">
          <AppNavigation current="governance" />
          <main id="governance-content" className="lf-product-main">
            <FeedbackPanel tone={notice ? "error" : "loading"} title={notice ? "자산 정보를 열 수 없습니다" : "자산 정보를 불러오는 중"}>
              {notice?.message ?? "잠시만 기다려 주세요."}
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
      <a className="lf-skip-link" href="#governance-content">자산 정보로 바로가기</a>
      <div className="lf-product-shell">
        <AppNavigation current="governance" />
        <main id="governance-content" className="lf-product-main">
          <header className="lf-product-hero">
            <div className="lf-product-hero__copy">
              <p className="lf-eyebrow">자산 정보</p>
              <h1>변경된 자료를 확인하고 <span>최신 정보로 게시하세요.</span></h1>
              <p>새 자료에서 달라진 내용을 확인한 뒤, 담당자 검토와 최종 승인을 거쳐 현장 팀에 공유합니다.</p>
            </div>
            <div className="lf-product-hero__meta">
              <StatusBadge tone={state.stage === "published" ? "success" : "info"}>{stageLabels[state.stage]}</StatusBadge>
            </div>
          </header>

          {notice ? (
            <FeedbackPanel
              tone={notice.severity}
              title={notice.severity === "success" ? "변경 사항을 반영했습니다" : "작업을 완료하지 못했습니다"}
              action={notice.severity === "error" ? <ActionButton variant="secondary" onClick={() => void reload()}>최신 정보 다시 불러오기</ActionButton> : undefined}
            >
              {notice.message}
            </FeedbackPanel>
          ) : null}

          <section className="lf-product-section" aria-labelledby="publication-progress">
            <SectionHeading
              eyebrow="진행 상황"
              headingId="publication-progress"
              title="게시까지 네 단계"
              description="현재 단계와 다음 할 일을 한눈에 확인할 수 있습니다."
            />
            <GovernanceSurface variant={state.stage === "published" ? "accent" : "default"}>
              <ol className="lf-workflow">
                <WorkflowStep index={1} state={workflowStepState(stage, "source_uploaded")} title="자료 준비">7월 변경 자료</WorkflowStep>
                <WorkflowStep index={2} state={workflowStepState(stage, "extracted_candidate")} title="변경안 확인">달라진 내용 4건</WorkflowStep>
                <WorkflowStep index={3} state={workflowStepState(stage, "junior_confirmed")} title="1차 확인">데이터 담당자</WorkflowStep>
                <WorkflowStep index={4} state={workflowStepState(stage, "published")} title="최종 승인">선임 담당자</WorkflowStep>
              </ol>
            </GovernanceSurface>
          </section>

          <div className="lf-product-grid lf-product-grid--governance">
            <section aria-labelledby="source-review">
              <GovernanceSurface>
                <SectionHeading
                  eyebrow="자료 검토"
                  headingId="source-review"
                  title={`${source.buildingName} · ${source.title}`}
                  description={`${source.effectiveDate} 기준 · ${state.publication_scope.floor}`}
                />

                {state.candidates.length === 0 ? (
                  <FeedbackPanel tone="empty" title="아직 확인할 변경안이 없습니다">
                    자료에서 달라진 내용을 먼저 찾아보세요.
                  </FeedbackPanel>
                ) : (
                  <div className="lf-candidate-list" aria-label="자료에서 찾은 변경안">
                    {state.candidates.map((candidate) => (
                      <article className="lf-candidate" key={candidate.id}>
                        <div className="lf-candidate__heading">
                          <div>
                            <p className="lf-data-label">{candidate.floor}</p>
                            <h3>{fieldLabels[candidate.field]}</h3>
                          </div>
                          <StatusBadge tone={candidate.status === "published" ? "success" : "info"}>
                            {recordStatusLabels[candidate.status as keyof typeof recordStatusLabels] ?? "확인 필요"}
                          </StatusBadge>
                        </div>
                        <div className="lf-candidate__diff">
                          <div><span>기존 정보</span><del>{formatValue(candidate.field, candidate.previous_value)}</del></div>
                          <div><span>제안 정보</span><strong>{formatValue(candidate.field, candidate.proposed_value)}</strong></div>
                        </div>
                        <div className="lf-candidate__provenance">
                          <span>자료 일치도 {Math.round(candidate.confidence * 100)}%</span>
                          <details className="lf-technical-details"><summary>참고 정보</summary><code>{candidate.source_pointer} · {candidate.candidate_version_id}</code></details>
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
                  eyebrow="담당자"
                  headingId="role-control"
                  level={2}
                  variant="compact"
                  title="확인 담당자 선택"
                  description="데모에서 각 담당자의 업무 단계를 확인할 수 있습니다."
                />
                <label className="lf-field">
                  <span>현재 담당자</span>
                  <select value={actorId} onChange={(event) => setActorId(event.target.value)} disabled={busyAction !== null}>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.display_name} · {formatRole(user.role)}</option>
                    ))}
                  </select>
                </label>
                <dl className="lf-data-grid lf-data-grid--rail">
                  <DataFact label="담당자" value={actor.display_name} detail={formatRole(actor.role)} />
                  <DataFact label="현재 단계" value={stageLabels[state.stage]} detail="변경할 때마다 자동 저장됩니다" />
                </dl>
                <div className="lf-action-stack" aria-label="게시 작업">
                  <ActionButton
                    disabled={state.stage !== "source_uploaded" || actor.role !== "data_steward"}
                    loading={busyAction === "extract"}
                    onClick={() => void mutate("extract")}
                    trailingIcon={<ArrowUpRightIcon />}
                  >
                    변경안 4건 찾기
                  </ActionButton>
                  <ActionButton
                    disabled={state.stage !== "extracted_candidate" || actor.role !== "data_steward"}
                    loading={busyAction === "confirm"}
                    onClick={() => void mutate("confirm")}
                    variant="secondary"
                  >
                    변경안 확인 완료
                  </ActionButton>
                  <ActionButton
                    disabled={state.stage !== "junior_confirmed" || actor.role !== "senior_reviewer"}
                    loading={busyAction === "publish"}
                    onClick={() => void mutate("publish")}
                    variant="secondary"
                  >
                    승인하고 게시하기
                  </ActionButton>
                </div>
                <p className="lf-support-copy">
                  담당자별로 가능한 업무가 다릅니다. 다음 단계 담당자를 선택해 진행하세요.
                </p>
                <ActionButton loading={busyAction === "reset"} onClick={() => void mutate("reset")} variant="ghost">
                  데모 초기화
                </ActionButton>
              </GovernanceSurface>
            </aside>
          </div>

          <section className="lf-product-section" aria-labelledby="published-records">
            <SectionHeading
              eyebrow="정보 이력"
              headingId="published-records"
              title="현재 정보와 변경 이력"
              description="현재 사용 중인 정보와 이전 버전을 함께 확인할 수 있습니다."
              action={<Link className="lf-button lf-button--secondary" href="/mobile-preview">현장 화면 미리보기 <span className="lf-button__island"><ArrowUpRightIcon /></span></Link>}
            />
            <GovernanceSurface>
              <dl className="lf-data-grid">
                <DataFact label="현재 사용 정보" value={publishedRecords.length} detail="승인된 항목" state={state.stage === "published" ? "verified" : "default"} />
                <DataFact label="평면도 버전" value={state.files.length} detail="현재 및 이전 파일" />
                <DataFact label="확인 기록" value={state.audit.length} detail="담당자 결정" />
                <DataFact label="저장 상태" value="자동 저장" detail="데모를 닫아도 유지됩니다" />
              </dl>

              <div className="lf-ledger-grid">
                <div>
                  <h3>정보 버전</h3>
                  <div className="lf-table-wrap" tabIndex={0} aria-label="정보 버전 표">
                    <table className="lf-product-table">
                      <thead><tr><th>버전</th><th>항목</th><th>상태</th><th>사용 기간</th></tr></thead>
                      <tbody>{state.records.map((record) => (
                        <tr key={record.id}>
                          <td data-label="버전">
                            <span>버전 {record.version_no}</span>
                            <details className="lf-technical-details"><summary>참고 정보</summary><code>{record.id}</code></details>
                          </td>
                          <td data-label="항목">{fieldLabels[record.field]}</td>
                          <td data-label="상태"><StatusBadge tone={record.status === "published" ? "success" : record.status === "superseded" ? "neutral" : "info"}>{recordStatusLabels[record.status as keyof typeof recordStatusLabels] ?? record.status}</StatusBadge></td>
                          <td data-label="사용 기간">{record.valid_from} → {record.valid_to ?? "현재"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h3>평면도 버전</h3>
                  <div className="lf-version-list">
                    {state.files.map((file) => (
                      <article key={file.id}>
                        <div>
                          <strong>{file.filename}</strong>
                          <details className="lf-technical-details"><summary>참고 정보</summary><code>{file.id}</code></details>
                        </div>
                        <StatusBadge tone={file.status === "published" ? "success" : file.status === "superseded" ? "neutral" : "info"}>{recordStatusLabels[file.status as keyof typeof recordStatusLabels] ?? file.status}</StatusBadge>
                        <span>버전 {file.version_no} · {file.valid_from} → {file.valid_to ?? "현재"}</span>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </GovernanceSurface>
          </section>

          <section className="lf-product-section" aria-labelledby="audit-trail">
            <SectionHeading eyebrow="결정 기록" headingId="audit-trail" title="담당자 확인 이력" description="누가 언제 어떤 결정을 내렸는지 시간순으로 확인합니다." />
            <GovernanceSurface variant="subtle">
              {state.audit.length === 0 ? (
                <FeedbackPanel tone="empty" title="아직 확인 기록이 없습니다">변경안을 찾으면 첫 기록이 남습니다.</FeedbackPanel>
              ) : (
                <ol className="lf-audit-list">
                  {[...state.audit].reverse().map((event) => (
                    <li key={event.id}>
                      <span className="lf-audit-list__mark" aria-hidden="true" />
                      <div><strong>{auditEventLabels[event.event_type] ?? "정보 확인"}</strong><span>{formatRole(event.actor_role)}</span></div>
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
