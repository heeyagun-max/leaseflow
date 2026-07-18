"use client";

import { useEffect, useState } from "react";
import { type MobilePublishedSnapshot } from "@leaseflow/demo-data";
import Link from "next/link";

interface PublicRequest { id: string; source: "call" | "email"; status: "candidate" | "confirmed"; summary: { building_id: string | null; floor: string | null; requested_fields: string[]; requested_files: string[]; recipient: { name: string | null; organization: string | null }; deadline: string | null; ambiguities: Array<{ field: string; reason: string }> } }
interface PublicPackage { id: string; building_id: string; floor: string; status: "draft" | "edit_pending" | "approved" | "sent" | "stale"; subject: string; body: string; facts: Array<{ label: string; value: number; unit: string; version_id: string; source_pointer: string }>; files: Array<{ filename: string; version_id: string; source_pointer: string }>; recipients: { to: string[]; cc: string[]; configuration_id: string }; unresolved: string[]; protected_material_status: "verified"; edit_candidate: { subject: string; body: string } | null }
interface WorkflowView {
  revision: number; publication_stage: string; requests: PublicRequest[]; packages: PublicPackage[];
  activities: Array<{ event_type: string; summary: string }>; audit: Array<{ event_label: string; occurred_at: string }>;
}

const packageStatusLabels: Record<PublicPackage["status"], string> = {
  draft: "초안 작성 중",
  edit_pending: "문장 변경 검토 중",
  approved: "승인 완료",
  sent: "전달 완료",
  stale: "새 초안 필요",
};

const requestStatusLabels: Record<PublicRequest["status"], string> = {
  candidate: "요청 확인 필요",
  confirmed: "요청 확인 완료",
};

const factLabels: Record<string, string> = {
  marketed_area_py: "임대 면적",
  marketed_area: "임대 면적",
  rent_free_months: "렌트프리",
  rent_free: "렌트프리",
  supported_parking_spaces: "지원 주차",
  supported_parking: "지원 주차",
  availability_date: "입주 가능일",
};

const fileLabels: Record<string, string> = {
  current_floor_plan: "최신 평면도",
  floor_plan: "평면도",
  stacking_plan: "스태킹 플랜",
  availability_schedule: "공실 일정",
};

function friendlyLabel(value: string, labels: Record<string, string>, fallback: string) {
  const normalized = value.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  return labels[normalized] ?? fallback;
}

function friendlyFactValue(value: number, unit: string) {
  const units: Record<string, string> = { py: "평", months: "개월", spaces: "대" };
  return `${value}${units[unit] ?? ""}`;
}

function friendlyWorkflowError(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("role") || normalized.includes("permission") || normalized.includes("actor")) {
    return "현재 담당자는 이 작업을 할 수 없습니다.";
  }
  if (normalized.includes("revision") || normalized.includes("conflict") || normalized.includes("stale")) {
    return "다른 작업에서 정보가 먼저 변경되었습니다. 최신 내용을 다시 불러와 주세요.";
  }
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function MobilePreview() {
  const [snapshot, setSnapshot] = useState<MobilePublishedSnapshot | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      const [publishedResponse, workflowResponse] = await Promise.all([
        fetch("/api/mobile/published", { cache: "no-store" }), fetch("/api/mobile/workflow", { cache: "no-store" }),
      ]);
      if (!publishedResponse.ok || !workflowResponse.ok) throw new Error("자산 정보를 먼저 게시한 뒤 다시 시도해 주세요.");
      setSnapshot(await publishedResponse.json() as MobilePublishedSnapshot);
      setWorkflow(await workflowResponse.json() as WorkflowView);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "현장 업무를 불러오지 못했습니다."); }
  }

  async function act(action: Record<string, unknown>) {
    if (!workflow) return;
    setBusy(true);
    try {
      const response = await fetch("/api/mobile/workflow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...action, actor_id: "usr-manager", expected_revision: workflow.revision }),
      });
      const body = await response.json() as WorkflowView | { error?: string };
      if (!response.ok) throw new Error(friendlyWorkflowError("error" in body ? body.error : undefined));
      setWorkflow(body as WorkflowView); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  }

  useEffect(() => { void reload(); }, []);
  const request = workflow?.requests.at(-1);
  const pkg = workflow?.packages.at(-1);

  return <main className="lf-legacy-page">
    <header><div><div className="brand">LeaseFlow</div><span className="muted">현장 화면 미리보기</span></div><span className="pill">데모</span></header>
    {error && <div className="notice error">{error}</div>}
    <div className="grid">
      <section className="card">
        <div className="kicker">현재 임대 정보</div><h1>Cobalt Finance Center · 5층</h1>
        {snapshot && <>
          <div className="snapshot-grid"><Metric label="임대 면적" value={`${snapshot.marketed_area_py}평`}/><Metric label="렌트프리" value={`${snapshot.rent_free_months}개월`}/><Metric label="지원 주차" value={`${snapshot.supported_parking_spaces}대`}/></div>
          <div className="plan"><strong>평면도</strong><span>{snapshot.floor_plan.filename}</span></div>
        </>}
        <p className="hint">마지막 승인 내용을 기준으로 표시합니다.</p>
      </section>
      <section className="card">
        <div className="kicker">요청 처리</div>
        <h2>{pkg ? packageStatusLabels[pkg.status] : request ? requestStatusLabels[request.status] : "새 요청 가져오기"}</h2>
        {!request && <div className="actions"><button type="button" className="primary" disabled={busy || !workflow} onClick={() => void act({ action: "import", source: "call" })}>통화 요청 가져오기</button><button type="button" className="secondary" disabled={busy || !workflow} onClick={() => void act({ action: "import", source: "email" })}>이메일 요청 가져오기</button></div>}
        {request?.status === "candidate" && <><RequestSummary request={request}/><button type="button" className="primary" disabled={busy} onClick={() => void act({ action: "confirm", request_id: request.id })}>요청 확인 완료</button></>}
        {request?.status === "confirmed" && !pkg && <button type="button" className="primary" disabled={busy} onClick={() => void act({ action: "draft", request_id: request.id })}>안내 자료 만들기</button>}
        {pkg && (
          <PackagePanel pkg={pkg} busy={busy} act={act}/>
        )}
      </section>
    </div>
    <p className="lf-demo-boundary">데모 데이터만 사용하며 실제 이메일·전화·로그인 연동은 없습니다.</p>
    <div className="actions"><button type="button" className="ghost" onClick={() => void reload()}>새로고침</button><Link className="button secondary" href="/">관리자 화면으로</Link></div>
  </main>;
}

function PackagePanel({ pkg, busy, act }: { pkg: PublicPackage; busy: boolean; act: (action: Record<string, unknown>) => Promise<void> }) {
  return <div>
    <div className="notice success"><strong>받는 사람</strong><br />{pkg.recipients.to.join(", ")}<br /><span>참조 {pkg.recipients.cc.join(", ") || "없음"}</span></div>
    {pkg.unresolved.length > 0 ? <div className="notice info">확인이 필요한 항목 {pkg.unresolved.length}건</div> : null}
    <p className="mono"><strong>{pkg.subject}</strong>{"\n"}{pkg.body}</p>
    <ul>{pkg.facts.map((fact) => <li key={fact.version_id}>{friendlyLabel(fact.label, factLabels, "임대 정보")}: {friendlyFactValue(fact.value, fact.unit)}</li>)}</ul>
    <ul>{pkg.files.map((file) => <li key={file.version_id}>첨부 파일: {file.filename}</li>)}</ul>
    {pkg.status === "edit_pending" && pkg.edit_candidate && <div className="grid">
      <div className="notice error"><strong>현재 문안</strong><p className="mono">{pkg.subject}{"\n"}{pkg.body}</p></div>
      <div className="notice info"><strong>제안 문안</strong><p className="mono">{pkg.edit_candidate.subject}{"\n"}{pkg.edit_candidate.body}</p></div>
    </div>}
    <div className="actions">
      {pkg.status === "draft" && <><button type="button" className="secondary" disabled={busy} onClick={() => void act({ action: "edit", package_id: pkg.id, instruction: "Make concise and courteous" })}>문장 다듬기</button><button type="button" className="primary" disabled={busy} onClick={() => void act({ action: "approve", package_id: pkg.id })}>안내 자료 승인</button></>}
      {pkg.status === "edit_pending" && <><button type="button" className="primary" disabled={busy} onClick={() => void act({ action: "decide", package_id: pkg.id, decision: "accept" })}>제안 문안 사용</button><button type="button" className="ghost" disabled={busy} onClick={() => void act({ action: "decide", package_id: pkg.id, decision: "reject" })}>기존 문안 유지</button></>}
      {pkg.status === "approved" && <button type="button" className="primary" disabled={busy} onClick={() => void act({ action: "send", package_id: pkg.id, idempotency_key: `judge-sandbox-${pkg.id}` })}>데모 전달하기</button>}
    </div>
    {pkg.status === "sent" && <div className="notice success">데모 전달을 기록했습니다.</div>}
  </div>;
}

function RequestSummary({ request }: { request: PublicRequest }) {
  const summary = request.summary;
  return <div className="notice info">
    <strong>가져온 요청 내용을 확인해 주세요.</strong>
    <ul>
      <li>건물: {summary.building_id ? "Cobalt Finance Center" : "확인 필요"}</li>
      <li>층: {summary.floor ?? "확인 필요"}</li>
      <li>요청 정보: {summary.requested_fields.map((field) => friendlyLabel(field, factLabels, "요청 정보")).join(", ") || "없음"}</li>
      <li>요청 파일: {summary.requested_files.map((file) => friendlyLabel(file, fileLabels, "요청 자료")).join(", ") || "없음"}</li>
      <li>수신자: {summary.recipient.name ?? "확인 필요"} · {summary.recipient.organization ?? "확인 필요"}</li>
      <li>기한: {summary.deadline ?? "확인 필요"}</li>
      <li>추가 확인: {summary.ambiguities.length ? summary.ambiguities.map((item) => `${friendlyLabel(item.field, factLabels, "요청 정보")}: ${item.reason}`).join("; ") : "없음"}</li>
    </ul>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
