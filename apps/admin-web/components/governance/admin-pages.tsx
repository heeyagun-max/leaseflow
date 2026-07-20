"use client";

import type { DemoState } from "@leaseflow/demo-data";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useAdminData, type ReportWorkflow } from "./admin-data";
import {
  assetCategoryLabels,
  assetSlug,
  assetStatusLabels,
  classificationLabels,
  confidentialityLabels,
  extractionLabels,
  fieldLabels,
  formatBytes,
  formatDate,
  formatDateTime,
  formatFieldValue,
  publicationStageLabels,
  publicationStatusLabels,
  roleLabels,
} from "@/lib/admin-format";

type AdminView =
  | "home" | "sources" | "source-new" | "source-detail"
  | "changes" | "change-detail" | "publishing" | "publishing-detail"
  | "operations" | "operation-versions" | "operation-files"
  | "settings" | "settings-access" | "settings-audit";

export function matchesReviewBatchRef(batchRef: string | undefined, reviewBatchRef: string) {
  return typeof batchRef === "string" && batchRef === reviewBatchRef;
}

export function formatCandidateEvidence(pointer: string) {
  const labels: Record<string, string> = {
    "July update / 5F": "7월 업데이트 · 5층",
    "July update / 5F plan": "7월 업데이트 · 5층 평면도",
    "July update / incentives": "7월 업데이트 · 지원 조건",
    "July update / parking": "7월 업데이트 · 주차 조건",
  };
  return labels[pointer] ?? "원문 직접 확인";
}

const sourceNav = [
  { href: "/sources", label: "전체 원자료" },
  { href: "/sources/new", label: "자료 등록 안내" },
] as const;
const operationsNav = [
  { href: "/operations", label: "현재 정보" },
  { href: "/operations/versions", label: "버전 이력" },
  { href: "/operations/files", label: "파일 이력" },
] as const;
const settingsNav = [
  { href: "/settings", label: "Recipient Groups & Schedule" },
  { href: "/settings/access", label: "Users & Access" },
  { href: "/settings/audit", label: "Delivery & Audit Log" },
] as const;

function LocalNav({ current, items }: { current: string; items: readonly { href: string; label: string }[] }) {
  return (
    <nav className="lf-admin-local-nav" aria-label="현재 업무 보기">
      {items.map((item) => (
        <Link aria-current={current === item.href ? "page" : undefined} href={item.href} key={item.href}>{item.label}</Link>
      ))}
    </nav>
  );
}

function PageHeader({ title }: { title: string }) {
  return <header className="lf-admin-page-header"><h1 tabIndex={-1}>{title}</h1></header>;
}

function Status({ children, tone = "info" }: { children: ReactNode; tone?: "error" | "info" | "neutral" | "success" | "warning" }) {
  return <span className={`lf-admin-status lf-admin-status--${tone}`}>{children}</span>;
}

function Feedback({ action, focus = false, message, title, tone = "info" }: { action?: ReactNode; focus?: boolean; message: string; title: string; tone?: "error" | "info" | "success" | "warning" }) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) feedbackRef.current?.focus();
  }, [focus, message]);
  return (
    <div ref={feedbackRef} tabIndex={-1} className={`lf-admin-feedback lf-admin-feedback--${tone}`} role={tone === "error" ? "alert" : undefined} aria-live={tone === "success" ? "polite" : undefined}>
      <h3>{title}</h3><p>{message}</p>{action ? <div>{action}</div> : null}
    </div>
  );
}

function DataState({ children, title }: { children: (workflow: NonNullable<ReturnType<typeof useAdminData>["workflow"]>) => ReactNode; title: string }) {
  const { error, reload, workflow } = useAdminData();
  if (!workflow) {
    return (
      <><PageHeader title={title} /><section aria-labelledby="data-state-heading"><h2 id="data-state-heading">업무 정보</h2>{error
        ? <Feedback tone="error" title="업무 정보를 열 수 없습니다" message={error} action={<button className="lf-admin-button" onClick={() => void reload()} type="button">다시 시도</button>} />
        : <div className="lf-admin-skeleton" aria-busy="true" aria-label="업무 정보를 불러오는 중"><span /><span /><span /></div>}
      </section></>
    );
  }
  return <>{children(workflow)}</>;
}

function actorRole(workflow: NonNullable<ReturnType<typeof useAdminData>["workflow"]>, actorId: string) {
  return workflow.users.find((user) => user.id === actorId)?.role ?? "";
}

function sourceFilename(workflow: NonNullable<ReturnType<typeof useAdminData>["workflow"]>) {
  return workflow.state.asset_registry.assets.find((asset) => asset.observed_filenames[0]?.includes("20260718"))?.observed_filenames[0]
    ?? workflow.state.asset_registry.assets[0]?.observed_filenames[0]
    ?? "원자료";
}

function currentTask(workflow: NonNullable<ReturnType<typeof useAdminData>["workflow"]>, role: string) {
  const stage = workflow.state.stage;
  const changeHref = `/changes/${encodeURIComponent(workflow.reviewBatchRef)}`;
  const publishHref = `/publishing/${encodeURIComponent(workflow.reviewBatchRef)}`;
  if (role === "data_steward") {
    if (stage === "source_uploaded") return { href: `/sources/${assetSlug(sourceFilename(workflow))}`, title: "원자료 확인 필요", next: "확인 후 변경 추출", status: "원자료 확인" };
    if (stage === "extracted_candidate") return { href: changeHref, title: "변경 후보 1차 검토", next: "완료 후 선임 승인", status: "검토 필요" };
    return { href: changeHref, title: "선임 검토 인계 상태 확인", next: "선임 검토자 처리", status: "인계 완료" };
  }
  if (role === "senior_reviewer") {
    return { href: stage === "junior_confirmed" ? publishHref : "/publishing", title: stage === "junior_confirmed" ? "선임 승인과 게시" : "승인 대기열 확인", next: "게시 후 운영 정보 반영", status: stage === "published" ? "게시 완료" : "승인 대기" };
  }
  return { href: "/reports", title: "건물별 임대인 보고 준비", next: "검토 후 사람 승인", status: "보고 준비" };
}

function HomePage() {
  const { actorId } = useAdminData();
  return <DataState title="오늘의 업무">{(workflow) => {
    const role = actorRole(workflow, actorId);
    const task = currentTask(workflow, role);
    return <>
      <PageHeader title="오늘의 업무" />
      <section aria-labelledby="today-queue-heading">
        <div className="lf-admin-section-heading"><h2 id="today-queue-heading">내 작업 대기열</h2><span>1건</span></div>
        <ul className="lf-admin-queue">
          <li><Link href={task.href}><div><h3>{task.title}</h3><p>{workflow.source.buildingName} · {sourceFilename(workflow)}</p></div><dl><div><dt>상태</dt><dd>{task.status}</dd></div><div><dt>다음</dt><dd>{task.next}</dd></div><div><dt>기준일</dt><dd><time dateTime={workflow.source.effectiveDate}>{formatDate(workflow.source.effectiveDate)}</time></dd></div></dl></Link></li>
        </ul>
      </section>
      <section aria-labelledby="today-handoff-heading" className="lf-admin-readonly">
        <h2 id="today-handoff-heading">업무 인계 원칙</h2>
        <p>현재 역할의 확인이 끝나면 다음 담당자의 대기열로 이동합니다. 후보 정보는 승인·게시 전까지 공식 운영 정보를 바꾸지 않습니다.</p>
      </section>
    </>;
  }}</DataState>;
}

function SourcesPage() {
  const params = useSearchParams();
  const query = (params.get("query") ?? "").trim().toLocaleLowerCase("ko-KR");
  const category = params.get("category") ?? "all";
  return <DataState title="원자료">{(workflow) => {
    const assets = workflow.state.asset_registry.assets.filter((asset) => {
      const matchesQuery = !query || asset.observed_filenames.some((name) => name.toLocaleLowerCase("ko-KR").includes(query)) || asset.source_organization.toLocaleLowerCase("ko-KR").includes(query);
      return matchesQuery && (category === "all" || asset.document_category === category);
    });
    return <>
      <LocalNav current="/sources" items={sourceNav} />
      <PageHeader title="원자료" />
      <section aria-labelledby="source-filter-heading"><h2 id="source-filter-heading">검색과 필터</h2>
        <form className="lf-admin-filter" action="/sources" method="get">
          <label><span>파일명 또는 제공처</span><input defaultValue={params.get("query") ?? ""} name="query" type="search" /></label>
          <label><span>자료 종류</span><select defaultValue={category} name="category"><option value="all">전체 종류</option>{Object.entries(assetCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="lf-admin-button" type="submit">목록 적용</button>
        </form>
      </section>
      <section aria-labelledby="source-list-heading"><div className="lf-admin-section-heading"><h2 id="source-list-heading">원자료 목록</h2><span>{assets.length}건</span></div>
        {assets.length === 0 ? <Feedback title="조건에 맞는 원자료가 없습니다" message="검색어나 자료 종류를 바꾸면 전체 합성 원자료를 다시 확인할 수 있습니다." action={<Link className="lf-admin-button lf-admin-button--secondary" href="/sources">필터 지우기</Link>} /> : <SourceTable assets={assets} />}
      </section>
    </>;
  }}</DataState>;
}

type Asset = DemoState["asset_registry"]["assets"][number];

function SourceTable({ assets }: { assets: Asset[] }) {
  return <div className="lf-admin-registry">
    <table><thead><tr><th scope="col">파일</th><th scope="col">종류</th><th scope="col">제공처</th><th scope="col">기준일</th><th scope="col">상태</th></tr></thead>
      <tbody>{assets.map((asset) => { const registeredAt = asset.audit_provenance[0]?.occurred_at; return <tr key={asset.id}><td><Link href={`/sources/${assetSlug(asset.observed_filenames[0] ?? "source")}`}>{asset.observed_filenames[0] ?? "파일명 확인 필요"}</Link></td><td>{assetCategoryLabels[asset.document_category]}</td><td>{asset.source_organization}</td><td><time dateTime={registeredAt}>{formatDate(registeredAt)}</time></td><td><Status tone={asset.status === "published" ? "success" : "info"}>{assetStatusLabels[asset.status]}</Status></td></tr>; })}</tbody>
    </table>
    <ul className="lf-admin-registry-mobile">{assets.map((asset) => <li key={asset.id}><Link href={`/sources/${assetSlug(asset.observed_filenames[0] ?? "source")}`}><h3>{asset.observed_filenames[0] ?? "파일명 확인 필요"}</h3><dl><div><dt>종류</dt><dd>{assetCategoryLabels[asset.document_category]}</dd></div><div><dt>제공처</dt><dd>{asset.source_organization}</dd></div><div><dt>상태</dt><dd>{assetStatusLabels[asset.status]}</dd></div></dl></Link></li>)}</ul>
  </div>;
}

function SourceNewPage() {
  return <><LocalNav current="/sources/new" items={sourceNav} /><PageHeader title="자료 등록 안내" />
    <section aria-labelledby="source-new-heading" className="lf-admin-readonly"><h2 id="source-new-heading">합성 원자료만 사용</h2><p>이 해커톤 데모는 저장소에 포함된 합성 SVG·PDF·워크북만 사용합니다. 임의 파일 업로드 기능은 연결되어 있지 않아 등록 버튼을 제공하지 않습니다.</p><Link className="lf-admin-button" href="/sources">등록된 합성 원자료 보기</Link></section>
  </>;
}

function SourceDetailPage({ sourceRef }: { sourceRef?: string }) {
  const { actorId, busy, mutate, mutateAsset } = useAdminData();
  return <DataState title="원자료 상세">{(workflow) => {
    const filename = decodeURIComponent(sourceRef ?? "");
    const asset = workflow.state.asset_registry.assets.find((item) => item.observed_filenames.includes(filename));
    if (!asset) return <><LocalNav current="" items={sourceNav} /><PageHeader title="원자료를 찾을 수 없습니다" /><section aria-labelledby="missing-source-heading"><h2 id="missing-source-heading">목록으로 돌아가기</h2><Feedback tone="error" title="원자료를 열 수 없습니다" message="선택한 원자료가 현재 데모 목록에 없습니다. 목록을 다시 불러와 다른 자료를 선택해 주세요." action={<Link className="lf-admin-button" href="/sources">원자료 목록</Link>} /></section></>;
    const role = actorRole(workflow, actorId);
    const canConfirm = asset.status === "registered" && asset.classification_state === "candidate" && role === "data_steward";
    const canPublish = asset.status === "steward_confirmed" && asset.externally_shareable && role === "senior_reviewer";
    const canExtract = workflow.state.stage === "source_uploaded" && asset.extraction_state !== "unsupported" && role === "data_steward";
    const previewable = asset.document_category === "floor_plan" && asset.status === "published" && asset.observed_filenames[0]?.endsWith(".svg");
    return <>
      <LocalNav current="" items={sourceNav} /><PageHeader title={asset.observed_filenames[0] ?? "원자료 상세"} />
      <div className="lf-admin-review-grid" aria-busy={busy !== null}>
        <div>
          <section aria-labelledby="source-info-heading" className="lf-admin-surface"><h2 id="source-info-heading">자료 정보</h2><dl className="lf-admin-facts"><div><dt>자료 종류</dt><dd>{assetCategoryLabels[asset.document_category]}</dd></div><div><dt>제공처</dt><dd>{asset.source_organization}</dd></div><div><dt>파일 정보</dt><dd>{asset.extension.toUpperCase()} · {formatBytes(asset.byte_size)}</dd></div><div><dt>자료 작성일</dt><dd><time dateTime={asset.artifact_date ?? undefined}>{formatDate(asset.artifact_date)}</time></dd></div><div><dt>공유 범위</dt><dd>{confidentialityLabels[asset.confidentiality]}</dd></div><div><dt>분류 상태</dt><dd>{classificationLabels[asset.classification_state]}</dd></div></dl></section>
          <section aria-labelledby="source-preview-heading" className="lf-admin-surface"><h2 id="source-preview-heading">원문 미리보기</h2>{previewable ? <figure className="lf-admin-preview"><img alt={`${asset.observed_filenames[0]} 실제 합성 평면도`} src={`/api/mobile/files/${encodeURIComponent(asset.observed_filenames[0]!)}`} /><figcaption>현재 게시되어 외부 사용이 허용된 합성 SVG 파일입니다.</figcaption></figure> : <Feedback title="미리보기를 제공하지 않는 형식입니다" message="파일명과 출처는 보존했습니다. 원문을 직접 확인한 뒤 다음 담당자에게 인계해 주세요." />}</section>
          <section aria-labelledby="source-history-heading" className="lf-admin-surface"><h2 id="source-history-heading">처리 기록</h2><ol className="lf-admin-timeline">{asset.audit_provenance.map((event, index) => <li key={`${event.event}-${event.occurred_at}-${index}`}><h3>{event.event === "registered" ? "원자료 등록" : event.event === "published" ? "원자료 게시" : "원자료 확인"}</h3><time dateTime={event.occurred_at}>{formatDateTime(event.occurred_at)}</time></li>)}</ol></section>
        </div>
        <aside className="lf-admin-decision" aria-labelledby="source-decision-heading"><h2 id="source-decision-heading">현재 결정</h2><Status tone={asset.status === "published" ? "success" : "info"}>{assetStatusLabels[asset.status]}</Status><p>{extractionLabels[asset.extraction_state]}</p>
          {canConfirm ? <button className="lf-admin-button" disabled={busy !== null} onClick={() => void mutateAsset(asset.id, "confirm")} type="button">{busy ? "저장 중…" : "분류 확인"}</button>
            : canPublish ? <button className="lf-admin-button" disabled={busy !== null} onClick={() => void mutateAsset(asset.id, "publish")} type="button">{busy ? "게시 중…" : "승인하고 게시"}</button>
              : canExtract ? <button className="lf-admin-button" disabled={busy !== null} onClick={() => void mutate("extract")} type="button">{busy ? "변경 내용 확인 중…" : "변경 내용 찾기"}</button>
                : <p className="lf-admin-handoff">다음: {asset.extraction_state === "unsupported" ? "원문 직접 확인" : asset.status === "published" ? "현재 자료로 현장 공유 가능" : "현재 단계 담당자 확인 대기"}</p>}
          {role !== "data_steward" && role !== "senior_reviewer" ? <p className="lf-admin-permission">현재 역할은 이 자료를 읽을 수 있지만 분류·게시할 수 없습니다.</p> : null}
        </aside>
      </div>
    </>;
  }}</DataState>;
}

function ChangesPage({ publishing = false }: { publishing?: boolean }) {
  return <DataState title={publishing ? "승인·게시" : "변경 검토"}>{(workflow) => {
    const prefix = publishing ? "/publishing" : "/changes";
    const href = `${prefix}/${encodeURIComponent(workflow.reviewBatchRef)}`;
    const available = publishing ? workflow.state.stage === "junior_confirmed" || workflow.state.stage === "published" : workflow.state.candidates.length > 0;
    return <><PageHeader title={publishing ? "승인·게시" : "변경 검토"} />
      <section aria-labelledby="change-queue-heading"><div className="lf-admin-section-heading"><h2 id="change-queue-heading">{publishing ? "승인 대기" : "검토 대기"}</h2><span>{available ? 1 : 0}건</span></div>
        {available ? <ul className="lf-admin-queue"><li><Link href={href}><div><h3>{workflow.source.buildingName} · 5층 변경</h3><p>{sourceFilename(workflow)}</p></div><dl><div><dt>상태</dt><dd>{publicationStageLabels[workflow.state.stage]}</dd></div><div><dt>변경</dt><dd>{workflow.state.candidates.length}개 항목</dd></div><div><dt>기준일</dt><dd><time dateTime={workflow.source.effectiveDate}>{formatDate(workflow.source.effectiveDate)}</time></dd></div></dl></Link></li></ul>
          : <Feedback title={publishing ? "현재 승인 대기 항목이 없습니다" : "현재 검토할 변경 후보가 없습니다"} message={publishing ? "데이터 담당자의 1차 확인이 끝나면 이 대기열에 표시됩니다." : "원자료에서 변경 내용을 찾으면 이 대기열에 표시됩니다."} action={!publishing ? <Link className="lf-admin-button" href={`/sources/${assetSlug(sourceFilename(workflow))}`}>원자료 확인</Link> : undefined} />}
      </section></>;
  }}</DataState>;
}

function Comparison({ state }: { state: DemoState }) {
  return <ul className="lf-admin-comparison">{state.candidates.map((candidate) => <li key={candidate.id}><h3>{fieldLabels[candidate.field]}</h3><div><dl><div><dt>현재 정보</dt><dd>{formatFieldValue(candidate.field, candidate.previous_value)}</dd></div><div><dt>제안 정보</dt><dd>{formatFieldValue(candidate.field, candidate.proposed_value)}</dd></div></dl><p><strong>근거</strong> {formatCandidateEvidence(candidate.source_pointer)}</p><p>{candidate.source_state === "confirmed" ? "원문에서 직접 확인된 후보" : "원문 추가 확인 필요"}</p></div></li>)}</ul>;
}

function ReviewDetailPage({ batchRef, publishing = false }: { batchRef?: string; publishing?: boolean }) {
  const { actorId, busy, mutate } = useAdminData();
  return <DataState title={publishing ? "승인 검토" : "변경 확인"}>{(workflow) => {
    if (!matchesReviewBatchRef(batchRef, workflow.reviewBatchRef)) {
      const listHref = publishing ? "/publishing" : "/changes";
      return <><PageHeader title={publishing ? "승인 항목을 찾을 수 없습니다" : "변경 항목을 찾을 수 없습니다"} /><section aria-labelledby="missing-review-heading"><h2 id="missing-review-heading">목록으로 돌아가기</h2><Feedback tone="error" title="선택한 검토 항목을 열 수 없습니다" message="현재 합성 데모에 등록된 검토 항목이 아닙니다. 목록에서 실제 항목을 다시 선택해 주세요." action={<Link className="lf-admin-button" href={listHref}>{publishing ? "승인 대기 목록" : "변경 검토 목록"}</Link>} /></section></>;
    }
    const role = actorRole(workflow, actorId);
    const canConfirm = !publishing && workflow.state.stage === "extracted_candidate" && role === "data_steward";
    const canPublish = publishing && workflow.state.stage === "junior_confirmed" && role === "senior_reviewer";
    return <><PageHeader title={publishing ? "승인 검토" : "변경 확인"} />
      <div className="lf-admin-review-grid" aria-busy={busy !== null}>
        <section aria-labelledby="comparison-heading" className="lf-admin-surface lf-admin-evidence"><h2 id="comparison-heading">근거와 비교</h2>{workflow.state.candidates.length ? <Comparison state={workflow.state} /> : <Feedback title="비교할 변경 후보가 없습니다" message="원자료에서 변경 내용을 찾은 뒤 다시 확인해 주세요." action={<Link className="lf-admin-button" href={`/sources/${assetSlug(sourceFilename(workflow))}`}>원자료로 이동</Link>} />}</section>
        <aside className="lf-admin-decision" aria-labelledby="review-decision-heading"><h2 id="review-decision-heading">{publishing ? "선임 결정" : "검토 결정"}</h2><Status tone={workflow.state.stage === "published" ? "success" : "info"}>{publicationStageLabels[workflow.state.stage]}</Status>
          <p>{publishing ? "게시하면 현재 운영 정보와 외부 사용 가능 파일이 새 버전으로 바뀝니다." : "1차 확인은 후보를 선임 검토자에게 인계하며 공식 정보를 바꾸지 않습니다."}</p>
          {canConfirm ? <button className="lf-admin-button" disabled={busy !== null} onClick={() => void mutate("confirm")} type="button">{busy ? "확인 저장 중…" : "1차 확인 완료"}</button> : canPublish ? <button className="lf-admin-button" disabled={busy !== null} onClick={() => void mutate("publish")} type="button">{busy ? "게시 중…" : "승인하고 게시"}</button> : <p className="lf-admin-handoff">다음: {workflow.state.stage === "published" ? "운영 정보에서 현재 버전 확인" : publishing ? "선임 검토자 승인 대기" : "현재 단계 담당자 확인 대기"}</p>}
          {(publishing && role !== "senior_reviewer") || (!publishing && role !== "data_steward") ? <p className="lf-admin-permission">현재 역할은 내용을 읽을 수 있지만 이 단계의 결정을 저장할 수 없습니다.</p> : null}
        </aside>
      </div></>;
  }}</DataState>;
}

function OperationsPage({ view }: { view: "current" | "files" | "versions" }) {
  const currentPath = view === "current" ? "/operations" : `/operations/${view}`;
  const title = view === "current" ? "운영 정보" : view === "versions" ? "버전 이력" : "파일 이력";
  return <DataState title={title}>{(workflow) => {
    const state = workflow.state;
    const currentRecords = workflow.currentOperations.records;
    const currentFiles = workflow.currentOperations.files;
    return <><LocalNav current={currentPath} items={operationsNav} /><PageHeader title={title} />
      {view === "current" ? <><section aria-labelledby="current-facts-heading"><h2 id="current-facts-heading">현재 사실</h2><dl className="lf-admin-ledger">{currentRecords.map((record) => <div key={record.id}><dt>{fieldLabels[record.field]}</dt><dd>{formatFieldValue(record.field, record.value)}<span>{record.floor} · 버전 {record.version_no}</span></dd></div>)}</dl></section><section aria-labelledby="current-files-heading"><h2 id="current-files-heading">최신 파일</h2>{currentFiles.length ? <ul className="lf-admin-file-list">{currentFiles.map((file) => <li key={file.id}><h3>{file.filename}</h3><Status tone="success">현재 사용</Status><p>{file.floor} · 버전 {file.version_no} · <time dateTime={file.valid_from}>{formatDate(file.valid_from)}</time>부터</p></li>)}</ul> : <Feedback title="현재 사용할 수 있는 파일이 없습니다" message="선임 승인과 게시가 끝난 파일만 외부 운영에 사용할 수 있습니다." action={<Link className="lf-admin-button" href="/publishing">승인·게시 확인</Link>} />}</section></>
        : view === "versions" ? <HistoryTable records={state.records} /> : <FileHistory files={state.files} />}
    </>;
  }}</DataState>;
}

function HistoryTable({ records }: { records: DemoState["records"] }) {
  return <section aria-labelledby="version-history-heading"><h2 id="version-history-heading">현재 및 이전 버전</h2><div className="lf-admin-registry"><table><thead><tr><th scope="col">항목</th><th scope="col">값</th><th scope="col">버전</th><th scope="col">상태</th><th scope="col">사용 기간</th></tr></thead><tbody>{[...records].sort((a, b) => b.version_no - a.version_no).map((record) => <tr key={record.id}><td>{fieldLabels[record.field]}</td><td>{formatFieldValue(record.field, record.value)}</td><td>버전 {record.version_no}</td><td>{publicationStatusLabels[record.status]}</td><td><time dateTime={record.valid_from}>{formatDate(record.valid_from)}</time>부터 {record.valid_to ? <time dateTime={record.valid_to}>{formatDate(record.valid_to)}</time> : "현재"}</td></tr>)}</tbody></table></div><p className="lf-admin-handoff">읽기 전용 · 이전 버전은 외부 패키지와 보고에 사용할 수 없습니다.</p><Link className="lf-admin-button lf-admin-button--secondary" href="/operations">현재 정보 보기</Link></section>;
}

function FileHistory({ files }: { files: DemoState["files"] }) {
  return <section aria-labelledby="file-history-heading"><h2 id="file-history-heading">평면도 파일 버전</h2><ul className="lf-admin-file-list">{[...files].sort((a, b) => b.version_no - a.version_no).map((file) => <li key={file.id}><h3>{file.filename}</h3><Status tone={file.status === "published" ? "success" : file.status === "superseded" ? "neutral" : "warning"}>{publicationStatusLabels[file.status]}</Status><p>버전 {file.version_no} · <time dateTime={file.valid_from}>{formatDate(file.valid_from)}</time>부터 · {file.status === "superseded" ? "외부 사용 차단" : "현재 검토 상태"}</p></li>)}</ul><p className="lf-admin-handoff">읽기 전용 · 게시된 새 평면도는 이전 파일의 외부 사용을 즉시 차단합니다.</p><Link className="lf-admin-button lf-admin-button--secondary" href="/operations">현재 정보 보기</Link></section>;
}

function SettingsPage({ view }: { view: "access" | "audit" | "recipients" }) {
  const current = view === "recipients" ? "/settings" : `/settings/${view}`;
  const { reload, reportError, reportWorkflow } = useAdminData();
  return <DataState title="설정·기록">{(workflow) => {
    if (!workflow.canViewSettings) {
      return <><LocalNav current={current} items={settingsNav} /><PageHeader title="Audit & Settings" /><section aria-labelledby="settings-permission-heading"><h2 id="settings-permission-heading">Access</h2><Feedback tone="error" title="You do not have access to these settings." message="Only leasing managers can review recipient configuration, user access, and audit records." /></section></>;
    }
    const config = workflow.reportConfiguration;
    const recipientRoleLabels: Record<string, string> = {
      to_landlord_practical: "임대인 실무 담당",
      cc_landlord_team: "임대인 팀",
      cc_landlord_exec: "임대인 책임자",
      cc_lm_team: "임대 관리팀",
      cc_lm_exec: "임대 관리 책임자",
    };
    const recipients = (items: readonly { email: string; role: string }[]) => items.map((item) => `${item.email} (${recipientRoleLabels[item.role] ?? item.role})`).join(", ");
    return <><LocalNav current={current} items={settingsNav} /><PageHeader title="Audit & Settings" />
    {view === "recipients" ? config ? <><section aria-labelledby="recipient-heading"><h2 id="recipient-heading">수신자 그룹</h2><dl className="lf-admin-ledger"><div><dt>건물</dt><dd>{workflow.source.buildingName}</dd></div><div><dt>받는 사람</dt><dd>{recipients(config.recipients.to)}</dd></div><div><dt>참조</dt><dd>{recipients(config.recipients.cc)}</dd></div></dl><p className="lf-admin-readonly">합성 데모 구성 · 읽기 전용 · 수신자는 이 저장된 그룹에서 계산되며 모델이 새 수신자를 만들지 않습니다.</p></section><section aria-labelledby="schedule-heading"><h2 id="schedule-heading">보고 기간</h2><dl className="lf-admin-ledger"><div><dt>데모 보고 시작일</dt><dd><time dateTime={config.reportingPeriod.from}>{formatDate(config.reportingPeriod.from)}</time></dd></div><div><dt>데모 보고 종료일</dt><dd><time dateTime={config.reportingPeriod.to}>{formatDate(config.reportingPeriod.to)}</time></dd></div><div><dt>전달 범위</dt><dd>데모 발송 기록만 저장</dd></div></dl><p className="lf-admin-readonly">반복 일정과 자동 발송 설정은 이 데모 데이터에 포함되어 있지 않습니다.</p></section></> : <Feedback tone="error" title="보고 설정을 불러올 수 없습니다" message="저장된 수신자 구성을 확인할 수 없어 세부 정보를 표시하지 않습니다." />
      : view === "access" ? <section aria-labelledby="access-heading"><h2 id="access-heading">사용자·권한</h2><ul className="lf-admin-file-list">{workflow.users.map((user) => <li key={user.id}><h3>{user.display_name}</h3><Status>{roleLabels[user.role as keyof typeof roleLabels] ?? "업무 담당자"}</Status><p>{user.role === "data_steward" ? "원자료 분류와 변경 후보 1차 확인" : user.role === "senior_reviewer" ? "선임 승인과 게시" : "게시 정보 조회와 임대인 보고"}</p></li>)}</ul><p className="lf-admin-readonly">읽기 전용 · 이 데모는 실제 SSO나 회사 사용자 시스템과 연결되지 않습니다.</p></section>
        : <AuditRecordsState reload={reload} reportError={reportError} reportWorkflow={reportWorkflow} state={workflow.state} users={workflow.users} />}
  </>}}</DataState>;
}

function AuditRecordsState({ reload, reportError, reportWorkflow, state, users }: {
  reload: () => Promise<void>;
  reportError: string | null;
  reportWorkflow: ReportWorkflow | null;
  state: DemoState;
  users: readonly { id: string; display_name: string; role: string }[];
}) {
  const auditState = resolveAuditRecordsState(reportWorkflow, reportError);
  if (auditState.status === "error") {
    return <section aria-labelledby="audit-heading"><h2 id="audit-heading">감사 기록</h2><Feedback tone="error" title="감사 기록을 열 수 없습니다" message={auditState.message} action={<button className="lf-admin-button" onClick={() => void reload()} type="button">다시 시도</button>} /></section>;
  }
  return <AuditRecords reportAudit={auditState.reportAudit} state={state} users={users} />;
}

export function resolveAuditRecordsState(reportWorkflow: ReportWorkflow | null, reportError: string | null) {
  return !reportWorkflow && reportError
    ? { status: "error" as const, message: reportError }
    : { status: "ready" as const, reportAudit: reportWorkflow?.audit ?? [] };
}

function AuditRecords({ reportAudit, state, users }: {
  reportAudit: Array<{ event_label: string; occurred_at: string; actor_label: string; actor_role_label: string }>;
  state: DemoState;
  users: readonly { id: string; display_name: string; role: string }[];
}) {
  const labels: Record<DemoState["audit"][number]["event_type"], string> = {
    "source.extracted": "변경 후보 추출",
    "candidate.confirmed": "1차 확인 완료",
    "batch.senior_approved": "선임 승인 완료",
    "batch.published": "운영 정보 게시",
    "demo.reset": "합성 데모 초기화",
  };
  const publicationEvents = state.audit.map((event) => ({
    key: event.id,
    label: labels[event.event_type],
    actor: `${users.find((user) => user.id === event.actor_id)?.display_name ?? "업무 담당자"} · ${roleLabels[event.actor_role]}`,
    occurredAt: event.occurred_at,
  }));
  const reportEvents = reportAudit.map((event, index) => ({
    key: `report-${event.occurred_at}-${index}`,
    label: event.event_label,
    actor: `${event.actor_label} · ${event.actor_role_label}`,
    occurredAt: event.occurred_at,
  }));
  const events = [...publicationEvents, ...reportEvents].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return <section aria-labelledby="audit-heading"><h2 id="audit-heading">감사 기록</h2>{events.length ? <ol className="lf-admin-timeline">{events.map((event) => <li key={event.key}><h3>{event.label}</h3><p>{event.actor}</p><time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time></li>)}</ol> : <Feedback title="아직 감사 기록이 없습니다" message="변경 후보를 찾거나 사람이 결정을 저장하면 시간순 기록이 여기에 추가됩니다." />}</section>;
}

export function AdminPage({ batchRef, sourceRef, view }: { batchRef?: string; sourceRef?: string; view: AdminView }) {
  switch (view) {
    case "home": return <HomePage />;
    case "sources": return <SourcesPage />;
    case "source-new": return <SourceNewPage />;
    case "source-detail": return <SourceDetailPage {...(sourceRef ? { sourceRef } : {})} />;
    case "changes": return <ChangesPage />;
    case "change-detail": return <ReviewDetailPage {...(batchRef ? { batchRef } : {})} />;
    case "publishing": return <ChangesPage publishing />;
    case "publishing-detail": return <ReviewDetailPage {...(batchRef ? { batchRef } : {})} publishing />;
    case "operations": return <OperationsPage view="current" />;
    case "operation-versions": return <OperationsPage view="versions" />;
    case "operation-files": return <OperationsPage view="files" />;
    case "settings": return <SettingsPage view="recipients" />;
    case "settings-access": return <SettingsPage view="access" />;
    case "settings-audit": return <SettingsPage view="audit" />;
  }
}
