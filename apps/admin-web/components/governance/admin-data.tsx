"use client";

import type { DemoState } from "@leaseflow/demo-data";
import type { UserRole } from "@leaseflow/domain";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { safeWorkflowError } from "@/lib/admin-format";

export interface WorkflowResponse {
  state: DemoState;
  source: { id: string; buildingName: string; effectiveDate: string; title: string };
  users: readonly { id: string; display_name: string; role: UserRole }[];
  canViewSettings: boolean;
  reviewBatchRef: string;
  currentOperations: {
    records: DemoState["records"];
    files: DemoState["files"];
    asOf: string;
  };
  reportConfiguration: {
    buildingId: string;
    recipients: {
      to: readonly { email: string; role: string }[];
      cc: readonly { email: string; role: string }[];
    };
    reportingPeriod: { from: string; to: string };
  } | null;
  storage: string;
}

export interface ReportSections {
  key_issue: string;
  changes_since_last_report: string[];
  activity_summary: string[];
  negotiated_area_floor_changes: string[];
  competitor_buildings: string[];
  blocker_and_pending_approval: string[];
  next_actions: Array<{ action: string; owner: string; due_date: string }>;
}

export interface ReportPatchCandidate {
  command: string;
  findings: Array<{ finding: string; source_reference_ids: string[]; confidence: number }>;
  operations: Array<{ section: string; operation: string; before: unknown; after: unknown; source_reference_ids: string[] }>;
  unresolved: Array<{ field: string; question: string }>;
}

export interface PublicReport {
  id: string;
  building_id: string;
  building_label: string;
  reporting_period: { from: string; to: string };
  status: "approved" | "draft" | "patch_pending" | "sent" | "stale";
  sections: ReportSections;
  sources: Array<{ id: string; source_type: string; occurred_at: string; summary: string }>;
  attachments: Array<{ filename: string; version_id: string }>;
  recipients: { configuration_id: string; to: Array<{ email: string; role: string }>; cc: Array<{ email: string; role: string }> };
  unresolved: string[];
  pending_candidate: ReportPatchCandidate | null;
  accepted_patch_count: number;
  approval: { approved: boolean; approved_at: string | null };
  delivery: { sent: boolean; sent_at: string | null };
}

export interface ReportWorkflow {
  revision: number;
  publication_stage: string;
  allowedActions: Array<"draft" | "investigate" | "decide_patch" | "approve" | "send">;
  reports: PublicReport[];
  activities: Array<{ occurred_at: string; summary: string }>;
  audit: Array<{ event_label: string; occurred_at: string; actor_label: string; actor_role_label: string }>;
}

type WorkflowMutation = "confirm" | "extract" | "publish" | "reset";
type Notice = { message: string; tone: "error" | "success" };

interface AdminDataValue {
  actorId: string;
  busy: string | null;
  error: string | null;
  notice: Notice | null;
  reportError: string | null;
  reportWorkflow: ReportWorkflow | null;
  reload: () => Promise<void>;
  setActorId: (actorId: string) => void;
  workflow: WorkflowResponse | null;
  mutate: (action: WorkflowMutation) => Promise<void>;
  mutateAsset: (assetId: string, action: "confirm" | "publish") => Promise<void>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface AdminDataSnapshot {
  error: string | null;
  reportError: string | null;
  reportWorkflow: ReportWorkflow | null;
  workflow: WorkflowResponse | null;
}

async function fetchJson<T>(fetcher: FetchLike, path: string): Promise<T> {
  const response = await fetcher(path, { cache: "no-store" });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function loadAdminDataSnapshot(fetcher: FetchLike = fetch, actorId = "usr-junior", retries = 1): Promise<AdminDataSnapshot> {
  const query = `actor_id=${encodeURIComponent(actorId)}`;
  const [workflowResult, reportResult] = await Promise.allSettled([
    fetchJson<WorkflowResponse>(fetcher, `/api/demo/workflow?${query}`),
    fetchJson<ReportWorkflow>(fetcher, `/api/mobile/reports?${query}`),
  ]);
  if (workflowResult.status === "fulfilled" && reportResult.status === "fulfilled"
    && workflowResult.value.state.revision !== reportResult.value.revision) {
    if (retries > 0) return loadAdminDataSnapshot(fetcher, actorId, retries - 1);
    const consistencyError = "운영 정보와 보고 상태의 기준 시점이 다릅니다. 최신 상태를 다시 불러와 주세요.";
    return { workflow: null, reportWorkflow: null, error: consistencyError, reportError: consistencyError };
  }
  return {
    workflow: workflowResult.status === "fulfilled" ? workflowResult.value : null,
    error: workflowResult.status === "fulfilled"
      ? null
      : "운영 정보를 불러오지 못했습니다. 기존 공식 정보는 바뀌지 않았습니다. 다시 시도해 주세요.",
    reportWorkflow: reportResult.status === "fulfilled" ? reportResult.value : null,
    reportError: reportResult.status === "fulfilled"
      ? null
      : "임대인 보고를 불러오지 못했습니다. 승인·발송 상태는 바뀌지 않았습니다. 다시 시도해 주세요.",
  };
}

const AdminDataContext = createContext<AdminDataValue | null>(null);

const successMessages: Record<WorkflowMutation, string> = {
  extract: "자료에서 변경 후보를 찾았습니다. 현재 게시 정보와 비교해 주세요.",
  confirm: "1차 확인을 마쳤습니다. 선임 검토 대기열로 인계했습니다.",
  publish: "선임 승인과 게시를 마쳤습니다. 새 현재 정보가 운영 정보에 반영되었습니다.",
  reset: "합성 데모 업무를 처음 상태로 되돌렸습니다.",
};

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [actorId, setActorId] = useState("usr-junior");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportWorkflow, setReportWorkflow] = useState<ReportWorkflow | null>(null);
  const loadSequence = useRef(0);

  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const snapshot = await loadAdminDataSnapshot(fetch, actorId);
    if (sequence !== loadSequence.current) return;
    setWorkflow(snapshot.workflow);
    setError(snapshot.error);
    setReportWorkflow(snapshot.reportWorkflow);
    setReportError(snapshot.reportError);
  }, [actorId]);

  useEffect(() => { void reload(); }, [reload]);

  const mutate = useCallback(async (action: WorkflowMutation) => {
    if (!workflow || busy) return;
    setBusy(action);
    setNotice(null);
    try {
      const response = await fetch(`/api/demo/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_id: actorId, expected_revision: workflow.state.revision }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error);
      await reload();
      setNotice({ tone: "success", message: successMessages[action] });
    } catch (mutationError) {
      setNotice({ tone: "error", message: safeWorkflowError(mutationError) });
    } finally {
      setBusy(null);
    }
  }, [actorId, busy, reload, workflow]);

  const mutateAsset = useCallback(async (assetId: string, action: "confirm" | "publish") => {
    if (!workflow || busy) return;
    const asset = workflow.state.asset_registry.assets.find((item) => item.id === assetId);
    if (!asset) return;
    setBusy(`asset:${assetId}`);
    setNotice(null);
    try {
      const response = await fetch("/api/demo/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "confirm" ? {
          action,
          actor_id: actorId,
          expected_revision: workflow.state.revision,
          asset_id: assetId,
          building_id: workflow.state.publication_scope.building_id,
          externally_shareable: asset.confidentiality === "public_candidate",
        } : {
          action,
          actor_id: actorId,
          expected_revision: workflow.state.revision,
          asset_id: assetId,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error);
      await reload();
      setNotice({
        tone: "success",
        message: action === "confirm"
          ? "원자료 분류를 확인했습니다. 외부 공유 자료는 선임 검토로 인계됩니다."
          : "승인된 원자료를 현장 공유 목록에 게시했습니다.",
      });
    } catch (mutationError) {
      setNotice({ tone: "error", message: safeWorkflowError(mutationError) });
    } finally {
      setBusy(null);
    }
  }, [actorId, busy, reload, workflow]);

  const value = useMemo(() => ({
    actorId, busy, error, notice, reload, reportError, reportWorkflow,
    setActorId: (nextActorId: string) => {
      loadSequence.current += 1;
      setWorkflow(null);
      setReportWorkflow(null);
      setActorId(nextActorId);
    },
    workflow, mutate, mutateAsset,
  }), [actorId, busy, error, mutate, mutateAsset, notice, reload, reportError, reportWorkflow, workflow]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const value = useContext(AdminDataContext);
  if (!value) throw new Error("AdminDataProvider is required.");
  return value;
}
