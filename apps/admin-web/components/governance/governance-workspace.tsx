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

const assetCategoryLabels = {
  perspective_render: "투시도",
  building_flyer: "건물 안내자료",
  portfolio_flyer: "포트폴리오 안내자료",
  floor_plan: "평면도",
  area_workbook: "면적 관리표",
  legal_document: "법무 문서",
} as const;

const assetStatusLabels = {
  registered: "담당자 확인 대기",
  steward_confirmed: "1차 확인 완료",
  published: "현장 공유 가능",
  superseded: "이전 자료",
  duplicate: "같은 자료",
  rejected: "사용하지 않음",
} as const;

const confidentialityLabels = {
  internal: "사내 전용",
  restricted: "제한 자료",
  legal_restricted: "법무 제한 자료",
  public_candidate: "공유 검토 가능",
} as const;

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
    senior_reviewer: "선임 검토자",
    lm_manager: "임대 관리 책임자",
  };
  return labels[role] ?? "담당자";
}

function statusBadgeTone(status: string): "info" | "neutral" | "success" {
  if (status === "published") return "success";
  if (status === "superseded") return "neutral";
  return "info";
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
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
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
        reset: "업무 흐름을 처음 상태로 되돌렸습니다.",
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

  async function mutateAsset(assetId: string, action: "confirm" | "publish") {
    if (!workflow) return;
    setBusyAssetId(assetId);
    setNotice(null);
    try {
      const asset = workflow.state.asset_registry.assets.find((item) => item.id === assetId);
      if (!asset) throw new Error("원자료를 찾을 수 없습니다.");
      const response = await fetch("/api/demo/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "confirm" ? {
          action, actor_id: actorId, expected_revision: workflow.state.revision, asset_id: assetId,
          building_id: workflow.state.publication_scope.building_id,
          externally_shareable: asset.confidentiality === "public_candidate",
        } : { action, actor_id: actorId, expected_revision: workflow.state.revision, asset_id: assetId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "원자료 결정을 저장하지 못했습니다.");
      await reload();
      setNotice({ severity: "success", message: action === "confirm" ? "원자료 분류를 1차 확인했습니다." : "승인된 원자료를 현장 공유 목록에 게시했습니다." });
    } catch (error) {
      setNotice({ severity: "error", message: friendlyWorkflowError(error) });
      await reload().catch(() => undefined);
    } finally {
      setBusyAssetId(null);
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
          <div className="lf-operations-topbar" aria-label="현재 운영 요약">
            <span><strong>{state.candidates.filter((candidate) => candidate.status === "candidate").length}</strong> 검토 대기</span>
            <span><strong>{publishedRecords.length}</strong> 현재 정보</span>
            <span><strong>{state.audit.length}</strong> 결정 기록</span>
          </div>
          <p className="lf-demo-boundary lf-demo-boundary--product">합성 데모 데이터 · 실제 이메일, 전화, 로그인 연결 없음</p>

          <header className="lf-product-hero" id="overview">
            <div className="lf-product-hero__copy">
              <p className="lf-eyebrow">검토·게시 / {source.buildingName}</p>
              <h1>변경된 정보를 <span>최종 확인하세요.</span></h1>
              <p>출처와 변경 내용을 확인한 뒤 현장 팀에 공유합니다.</p>
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
            <section aria-labelledby="source-review" id="source-review">
              <GovernanceSurface>
                <SectionHeading
                  eyebrow="자료 검토"
                  headingId="source-review"
                  title="원자료와 변경 내용"
                  description={`${source.title} · ${source.effectiveDate} 기준 · ${state.publication_scope.floor}`}
                />

                <div className="lf-source-sheet" aria-label="원자료 미리보기">
                  <div className="lf-source-sheet__blueprint" aria-hidden="true">
                    <span className="lf-source-sheet__zone">가용 구역</span>
                  </div>
                  <div className="lf-source-sheet__caption">
                    <span>원자료</span>
                    <strong>{source.title}</strong>
                    <small>{source.effectiveDate} · {source.buildingName}</small>
                  </div>
                </div>

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
                          <span>원자료와 연결됨</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </GovernanceSurface>
            </section>

            <aside className="lf-product-rail" aria-labelledby="role-control">
              <GovernanceSurface>
                <SectionHeading
                  eyebrow="최종 검토"
                  headingId="role-control"
                  level={2}
                  variant="compact"
                  title="확인과 결정을 한곳에서"
                  description="출처 확인부터 게시 승인까지 현재 단계에 필요한 행동만 표시합니다."
                />
                <ol className="lf-review-checklist" aria-label="검토 상태">
                  <li data-complete="true"><span aria-hidden="true">✓</span><div><strong>출처 확인</strong><small>{source.effectiveDate} 원자료</small></div></li>
                  <li data-complete={state.stage !== "source_uploaded"}><span aria-hidden="true">✓</span><div><strong>변경 내용 확인</strong><small>{state.candidates.length ? `${state.candidates.length}건 발견` : "확인 전"}</small></div></li>
                  <li data-complete={state.stage === "junior_confirmed" || state.stage === "published"}><span aria-hidden="true">✓</span><div><strong>1차 확인</strong><small>{state.stage === "source_uploaded" || state.stage === "extracted_candidate" ? "대기 중" : "완료"}</small></div></li>
                  <li data-complete={state.stage === "published"}><span aria-hidden="true">✓</span><div><strong>최종 승인</strong><small>{state.stage === "published" ? "현장 공유 중" : "대기 중"}</small></div></li>
                </ol>
                <label className="lf-field">
                  <span>검토 담당자</span>
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
                <p className="lf-support-copy">담당자별로 가능한 업무가 다릅니다. 다음 단계 담당자를 선택해 진행하세요.</p>
                <ActionButton
                  loading={busyAction === "reset"}
                  onClick={() => {
                    if (window.confirm("현재 데모 진행 기록을 지우고 처음부터 다시 시작할까요?")) void mutate("reset");
                  }}
                  variant="ghost"
                >
                  데모 다시 시작
                </ActionButton>
              </GovernanceSurface>
              <div className="lf-record-note">
                <span aria-hidden="true" />
                <p>출처와 승인 기록은 항상 함께 남습니다.</p>
              </div>
            </aside>
          </div>

          <section className="lf-product-section" aria-labelledby="source-assets">
            <SectionHeading
              eyebrow="원자료"
              headingId="source-assets"
              title="원자료 등록부"
              description="파일명·출처·분류 제안을 확인하고, 담당자와 선임 담당자의 결정을 순서대로 남깁니다."
            />
            <GovernanceSurface>
              <div className="lf-asset-registry" aria-label="원자료 등록부">
                {state.asset_registry.assets.map((asset) => (
                  <article className="lf-asset-card" key={asset.id}>
                    <div className="lf-asset-card__heading">
                      <div>
                        <p className="lf-data-label">{assetCategoryLabels[asset.document_category]}</p>
                        <h3>{asset.observed_filenames[0]}</h3>
                        {asset.observed_filenames.length > 1 ? <small>확인된 다른 파일명 {asset.observed_filenames.length - 1}개</small> : null}
                      </div>
                      <StatusBadge tone={statusBadgeTone(asset.status)}>
                        {assetStatusLabels[asset.status]}
                      </StatusBadge>
                    </div>
                    <dl className="lf-asset-card__facts">
                      <div><dt>자료 제공처</dt><dd>{asset.source_organization}</dd></div>
                      <div><dt>파일 정보</dt><dd>{asset.extension.toUpperCase()} · {Math.max(1, Math.round(asset.byte_size / 1024))}KB</dd></div>
                      <div><dt>자료 작성일</dt><dd>{asset.artifact_date ?? "파일명에서 확인되지 않음"}</dd></div>
                      <div><dt>공유 범위</dt><dd>{confidentialityLabels[asset.confidentiality]}</dd></div>
                      <div><dt>내용 확인</dt><dd>{asset.extraction_state === "unsupported" ? "직접 확인 필요" : "자동 분류 제안"}</dd></div>
                      <div><dt>검토 기록</dt><dd>{asset.reviewed_by ? `${formatRole(users.find((user) => user.id === asset.reviewed_by)?.role ?? "")} · ${asset.reviewed_at}` : "검토 전"}</dd></div>
                    </dl>
                    <div className="lf-asset-card__actions">
                      {asset.status === "registered" && asset.classification_state === "candidate" ? (
                        <ActionButton
                          variant="secondary"
                          disabled={actor.role !== "data_steward" || busyAssetId !== null}
                          loading={busyAssetId === asset.id}
                          onClick={() => void mutateAsset(asset.id, "confirm")}
                        >분류 확인</ActionButton>
                      ) : null}
                      {asset.status === "steward_confirmed" && asset.externally_shareable ? (
                        <ActionButton
                          variant="secondary"
                          disabled={actor.role !== "senior_reviewer" || busyAssetId !== null}
                          loading={busyAssetId === asset.id}
                          onClick={() => void mutateAsset(asset.id, "publish")}
                        >승인하고 게시</ActionButton>
                      ) : null}
                      {asset.classification_state === "manual_review" ? <span className="lf-support-copy">지원하지 않는 설계 파일 형식으로 직접 확인이 필요합니다.</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </GovernanceSurface>
          </section>

          <section className="lf-product-section" aria-labelledby="published-records">
            <SectionHeading
              eyebrow="정보 이력"
              headingId="published-records"
              title="현재 정보와 변경 이력"
              description="현재 사용 중인 정보와 이전 버전을 함께 확인할 수 있습니다."
              action={<Link className="lf-button lf-button--secondary" href="/mobile-preview">제품 내 현장 화면 미리보기 <span className="lf-button__island"><ArrowUpRightIcon /></span></Link>}
            />
            <GovernanceSurface>
              <dl className="lf-data-grid">
                <DataFact label="현재 사용 정보" value={publishedRecords.length} detail="승인된 항목" state={state.stage === "published" ? "verified" : "default"} />
                <DataFact label="평면도 버전" value={state.files.length} detail="현재 및 이전 파일" />
                <DataFact label="확인 기록" value={state.audit.length} detail="담당자 결정" />
                <DataFact label="저장 상태" value="자동 저장" detail="화면을 닫아도 유지됩니다" />
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
                          </td>
                          <td data-label="항목">{fieldLabels[record.field]}</td>
                          <td data-label="상태"><StatusBadge tone={statusBadgeTone(record.status)}>{recordStatusLabels[record.status as keyof typeof recordStatusLabels] ?? "확인 필요"}</StatusBadge></td>
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
                        </div>
                        <StatusBadge tone={statusBadgeTone(file.status)}>{recordStatusLabels[file.status as keyof typeof recordStatusLabels] ?? "확인 필요"}</StatusBadge>
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
