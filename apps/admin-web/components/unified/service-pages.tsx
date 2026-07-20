"use client";

import { demoSourceUpdate, demoUsers, type MobilePublishedSnapshot } from "@leaseflow/demo-data";
import { canPerform } from "@leaseflow/domain";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAdminData, type PublicReport, type ReportWorkflow } from "@/components/governance/admin-data";
import { buildReportMutationBody, ReportDetail, selectReportByRef } from "@/components/reporting/report-console";
import { formatDate } from "@/lib/admin-format";
import { weeklyReportSectionLabels, type WeeklyAutomation } from "@/lib/weekly-settings-schema";

type PublishedFact = { field: "marketed_area_py" | "rent_free_months" | "supported_parking_spaces"; value: number };
export type HomeIntent = "building_lookup" | "package_prepare" | "weekly_review" | "unsupported";
type HomeRequestResult = { text: string; confirmed: boolean; intent: HomeIntent; matched: boolean; message: string };

export interface OperationsWorkflow {
  revision: number;
  publication_stage: string;
  requests: Array<{ id: string; source: "call" | "email"; status: "candidate" | "confirmed"; summary: { building_id: string | null; floor: string | null; requested_fields: string[]; requested_files: string[]; recipient: { name: string | null; organization: string | null }; deadline: string | null; ambiguities: Array<{ field: string; reason: string }> } }>;
  packages: Array<{ id: string; building_id: string; floor: string; status: "draft" | "edit_pending" | "approved" | "sent" | "stale"; subject: string; body: string; facts: Array<{ label: string; value: number; unit: string }>; files: Array<{ filename: string }>; recipients: { to: string[]; cc: string[] }; unresolved: string[] }>;
  activities: readonly unknown[];
  audit: readonly unknown[];
}

export interface PublicBuildingSummary {
  building_id: string;
  building_name: string;
  search_aliases: string[];
  landlord_name: string;
  market: string;
  latest_changed_at: string;
  available_floors: string[];
  marketed_area_py: number;
  availability: string;
}

export interface PublishedDocumentReference {
  building_id: string;
  document_type: "monthly_owner_update" | "floor_plan" | "leasing_flyer" | "area_workbook" | "legal_document";
  reviewed_summary: string;
}

export interface OperationsSnapshot {
  snapshot_version: 1;
  revision: number;
  publication_stage: string;
  scope: { building_ids: string[] };
  published: MobilePublishedSnapshot;
  published_documents: PublishedDocumentReference[];
  buildings: PublicBuildingSummary[];
  workflow: OperationsWorkflow;
  reports: ReportWorkflow;
}

export interface WeeklyOperationalGroup {
  group_ref: string;
  landlord_name: string;
  cadence: "weekly" | "biweekly" | "monthly";
  meeting_weekday: "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
  meeting_time: string;
  next_meeting_on: string;
  owner_name: string;
  approver_name: string;
  automation: WeeklyAutomation;
  reports: Array<{
    building_id: string;
    building_name: string;
  }>;
}

export interface WeeklyOperationalGroupsProjection {
  revision: number;
  can_manage_settings: boolean;
  groups: WeeklyOperationalGroup[];
}

type WorkflowFetch = (input: string, init: RequestInit) => Promise<Response>;
type WeeklyDetailAction = "approve" | "investigate" | "decide_patch" | "send";
type WeeklyDetailBusy = Exclude<WeeklyDetailAction, "decide_patch"> | "patch-accept" | "patch-reject";
type WeeklyDetailNotice = { message: string; tone: "error" | "success" };

export async function performOperationsWorkflowAction(
  current: OperationsWorkflow,
  actorId: string,
  action: Record<string, unknown>,
  fetcher: WorkflowFetch = fetch,
): Promise<OperationsWorkflow> {
  const response = await fetcher("/api/mobile/workflow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...action, actor_id: actorId, expected_revision: current.revision }),
  });
  const result = await response.json() as OperationsWorkflow & { error?: string };
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function loadOperationsSnapshot(
  actorId: string,
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<OperationsSnapshot> {
  const response = await fetcher(`/api/operations/snapshot?actor_id=${encodeURIComponent(actorId)}`, { cache: "no-store" });
  const result = await response.json() as OperationsSnapshot & { error?: string };
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function performWeeklyReportAction(
  snapshot: OperationsSnapshot,
  actorId: string,
  reportId: string,
  action: WeeklyDetailAction,
  decision?: "accept" | "reject",
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<OperationsSnapshot> {
  const response = await fetcher("/api/mobile/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildReportMutationBody({
      action,
      actorId,
      reportId,
      revision: snapshot.reports.revision,
      ...(decision ? { decision } : {}),
    })),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error);
  return loadOperationsSnapshot(actorId, fetcher);
}

const fieldLabels: Record<string, string> = { marketed_area_py: "Available area", rent_free_months: "Rent-free", supported_parking_spaces: "Supported parking" };
const requestFieldLabels: Record<string, string> = {
  marketed_area: "Available area",
  marketed_area_py: "Available area",
  rent_free: "Rent-free",
  rent_free_months: "Rent-free",
  supported_parking: "Supported parking",
  supported_parking_spaces: "Supported parking",
};
const requestFileLabels: Record<string, string> = { current_floor_plan: "Current floor plan" };
const unitLabels: Record<string, string> = { marketed_area_py: " py", rent_free_months: " months", supported_parking_spaces: " spaces", py: " py", months: " months", spaces: " spaces" };
const packageLabels: Record<string, string> = { draft: "Review required", edit_pending: "Review suggested copy", approved: "Approved", sent: "Delivery recorded", stale: "Rebuild with current data" };
const reportLabels: Record<PublicReport["status"], string> = { draft: "Review required", patch_pending: "Review suggested changes", approved: "Approved", sent: "Delivered", stale: "Current data required" };

function requestFieldLabel(field: string): string {
  return requestFieldLabels[field] ?? "Leasing information requiring review";
}

function requestFileLabel(file: string): string {
  return requestFileLabels[file] ?? "File requiring review";
}

function formatChangeValue(field: string, value: string | number): string {
  if (field === "marketed_area_py" && typeof value === "number") return `${value.toLocaleString("en-US")} py`;
  if (field === "rent_free_months" && typeof value === "number") return `${value.toLocaleString("en-US")} months`;
  if (field === "supported_parking_spaces" && typeof value === "number") return `${value.toLocaleString("en-US")} spaces`;
  return String(value);
}

export function publishedFacts(published: MobilePublishedSnapshot): PublishedFact[] {
  return [
    { field: "marketed_area_py", value: published.marketed_area_py },
    { field: "rent_free_months", value: published.rent_free_months },
    { field: "supported_parking_spaces", value: published.supported_parking_spaces },
  ];
}

const externallyUsableDocumentTypes = new Set<PublishedDocumentReference["document_type"]>([
  "monthly_owner_update",
  "floor_plan",
  "leasing_flyer",
]);

export function publishedDocumentsForBuilding(
  documents: readonly PublishedDocumentReference[],
  buildingId: string,
): PublishedDocumentReference[] {
  return documents.filter((document) => document.building_id === buildingId
    && externallyUsableDocumentTypes.has(document.document_type));
}

function publishedDocumentTypeLabel(type: PublishedDocumentReference["document_type"]): string {
  if (type === "monthly_owner_update") return "Monthly leasing update";
  if (type === "floor_plan") return "Floor plan reference";
  return "Leasing reference";
}

export function formatRequestDeadline(value: string | null): string {
  if (!value) return "Schedule required";
  const normalized = value.trim().toLocaleLowerCase("en-US");
  const relativeLabels: Record<string, string> = {
    "today afternoon": "Today afternoon",
    "today morning": "Today morning",
    "tomorrow afternoon": "Tomorrow afternoon",
    "tomorrow morning": "Tomorrow morning",
  };
  if (relativeLabels[normalized]) return relativeLabels[normalized];
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Seoul",
    }).format(parsed);
  }
  return "Schedule required";
}

export function nextWorkAction(
  request: OperationsWorkflow["requests"][number] | undefined,
  pkg: OperationsWorkflow["packages"][number] | undefined,
): { label: string; state: string; completed: boolean } {
  if (pkg?.status === "sent") return { label: "Review delivery record", state: "Completed", completed: true };
  if (pkg?.status === "approved") return { label: "Record delivery", state: "Approved", completed: false };
  if (pkg?.status === "stale") return { label: "Rebuild with current data", state: "Current data required", completed: false };
  if (pkg?.status === "edit_pending") return { label: "Review suggested copy", state: "Review required", completed: false };
  if (pkg) return { label: "Approve customer package", state: "Awaiting approval", completed: false };
  if (request?.status === "confirmed") return { label: "Prepare customer package", state: "Request confirmed", completed: false };
  if (request) return { label: "Review request", state: "Review required", completed: false };
  return { label: "Import customer request", state: "New task", completed: false };
}

export function weeklyAttentionCount(
  reports: readonly PublicReport[],
  groups: WeeklyOperationalGroupsProjection | null,
): number {
  if (!groups) return reports.filter((report) => report.status !== "sent").length;
  const configuredBuildingIds = new Set(groups.groups.flatMap((group) => group.reports.map((building) => building.building_id)));
  const configuredAttention = [...configuredBuildingIds].filter((buildingId) => {
    const report = reports.find((item) => item.building_id === buildingId);
    return !report || report.status !== "sent";
  }).length;
  const unassignedAttention = reports.filter((report) => !configuredBuildingIds.has(report.building_id) && report.status !== "sent").length;
  return configuredAttention + unassignedAttention;
}

export function formatWeeklyMeeting(group: Pick<WeeklyOperationalGroup, "next_meeting_on" | "meeting_time"> | null): string {
  if (!group) return "Schedule required";
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(group.next_meeting_on);
  if (!matched || !/^([01]\d|2[0-3]):[0-5]\d$/.test(group.meeting_time)) return "Schedule required";
  const [, year, month, day] = matched;
  const date = new Date(`${year}-${month}-${day}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return "Schedule required";
  return `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }).format(date)} · ${group.meeting_time}`;
}

const weeklyCadenceLabels: Record<WeeklyOperationalGroup["cadence"], string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

export function weeklyAutomationSummary(automation: WeeklyAutomation): string[] {
  return [
    `Previous business day ${automation.checkpoints.pre_summary_time} · Pre-summary`,
    `Report day ${automation.checkpoints.morning_refresh_time} · Morning refresh`,
    `Report day ${automation.checkpoints.final_review_time} · Final review`,
    `Report day ${automation.checkpoints.delivery_time} · Ready for delivery`,
  ];
}

export function matchesBuildingSearch(building: PublicBuildingSummary, query: string) {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  if (!normalized) return true;
  return [
    building.building_name,
    ...building.search_aliases,
    building.landlord_name,
    building.market,
    ...building.available_floors,
  ].join(" ").toLocaleLowerCase("ko-KR").includes(normalized);
}

export function filterAndSortBuildings(buildings: readonly PublicBuildingSummary[], query: string) {
  return [...buildings]
    .filter((building) => matchesBuildingSearch(building, query))
    .sort((left, right) => Date.parse(right.latest_changed_at) - Date.parse(left.latest_changed_at));
}

export function interpretHomeRequest(
  text: string,
  published: { building_name: string; floor: string },
): { intent: HomeIntent; matched: boolean; message: string } {
  const normalized = text.trim().toLocaleLowerCase("ko-KR");
  const compact = normalized.replace(/\s+/g, "");
  const buildingCompact = published.building_name.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
  const currentBuildingMentioned = compact.includes(buildingCompact)
    || compact.includes("코발트")
    || compact.includes("cobalt");
  const buildingLike = normalized.match(/([가-힣a-z0-9 ]{2,30}(?:타워|센터|빌딩))/i)?.[1]
    ?.replace(/\s+/g, "")
    .toLocaleLowerCase("ko-KR");
  if (buildingLike && !currentBuildingMentioned && !buildingCompact.includes(buildingLike)) {
    return { intent: "unsupported", matched: false, message: "The building name does not match an available building. Check the name and try again." };
  }

  const requestedFloors = [...normalized.matchAll(/(\d{1,2})\s*(?:층|f)/gi)].map((match) => match[1]);
  const currentFloor = published.floor.match(/\d{1,2}/)?.[0];
  if (requestedFloors.length && currentFloor && requestedFloors.some((floor) => floor !== currentFloor)) {
    return { intent: "unsupported", matched: false, message: `현재 확인할 수 있는 층은 ${published.floor}입니다. 층을 다시 확인해 주세요.` };
  }

  const weeklyIntent = ["주간", "미팅", "보고", "이슈 정리"].some((keyword) => normalized.includes(keyword));
  if (weeklyIntent) return { intent: "weekly_review", matched: true, message: "" };
  const packageIntent = ["자료 준비", "자료준비", "안내 자료", "안내자료", "보낼 자료", "전달 자료"].some((keyword) => normalized.includes(keyword))
    || ((normalized.includes("평면도") || normalized.includes("도면"))
      && ["준비", "보낼", "전달"].some((keyword) => normalized.includes(keyword)));
  if (packageIntent) return { intent: "package_prepare", matched: true, message: "" };
  const buildingIntent = ["최신", "도면", "임대", "면적", "렌트프리", "주차", "조건"].some((keyword) => normalized.includes(keyword));
  if (buildingIntent) return { intent: "building_lookup", matched: true, message: "" };
  return { intent: "unsupported", matched: false, message: "Describe the information or package you need in a little more detail." };
}

function homeRequestStatus(result: HomeRequestResult): string {
  if (!result.matched) return "Review the request";
  if (result.confirmed) return "Confirmed";
  return "Confirm request";
}

function homeRequestUnderstanding(intent: HomeIntent, published: MobilePublishedSnapshot): string {
  if (intent === "weekly_review") return "Prepare this week's landlord meeting";
  if (intent === "package_prepare") return `Prepare a customer package for ${published.building_name} · ${published.floor}`;
  return `Find current information for ${published.building_name} · ${published.floor}`;
}

function weeklyActionSuccessMessage(
  action: WeeklyDetailAction,
  decision?: "accept" | "reject",
): string {
  switch (action) {
    case "investigate":
      return "Suggested changes were prepared from saved email records. Review them against the evidence.";
    case "decide_patch":
      return decision === "accept"
        ? "The suggested changes were applied to the report."
        : "The current report content was kept.";
    case "approve":
      return "The report was approved and is ready for a delivery record.";
    case "send":
      return "Delivery was recorded. No real email was sent.";
  }
}

function weeklyBusyAction(
  action: WeeklyDetailAction,
  decision?: "accept" | "reject",
): WeeklyDetailBusy | null {
  if (action !== "decide_patch") return action;
  if (decision === "accept") return "patch-accept";
  if (decision === "reject") return "patch-reject";
  return null;
}

function workflowProgressIndex(
  request: OperationsWorkflow["requests"][number] | undefined,
  pkg: OperationsWorkflow["packages"][number] | undefined,
): number {
  if (pkg?.status === "sent") return 4;
  if (pkg?.status === "approved") return 3;
  if (pkg) return 2;
  if (request?.status === "confirmed") return 1;
  if (request) return 0;
  return -1;
}

function PageHeader({ action, title }: { action?: ReactNode; title: string }) {
  return <header className="lf-service-header"><div><p className="lf-service-eyebrow">LeaseFlow</p><h1 tabIndex={-1}>{title}</h1></div>{action}</header>;
}

function LoadingPage({ title }: { title: string }) {
  return <><PageHeader title={title} /><div className="lf-admin-skeleton" aria-busy="true" aria-label="Loading information"><span /><span /><span /></div></>;
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return <section className="lf-service-state" role="alert"><h2>Information could not be loaded</h2><p>{message}</p><button className="lf-admin-button" onClick={retry} type="button">Try again</button></section>;
}

function CurrentFacts({ published }: { published: MobilePublishedSnapshot }) {
  return <dl className="lf-service-facts">{publishedFacts(published).map((fact) => <div key={fact.field}><dt>{fieldLabels[fact.field]}</dt><dd>{fact.value.toLocaleString("ko-KR")}{unitLabels[fact.field]}</dd></div>)}</dl>;
}

export function latestBuildingDetails(building: PublicBuildingSummary, published?: MobilePublishedSnapshot) {
  return [
    { label: "Landlord", value: building.landlord_name },
    { label: "Market", value: building.market },
    { label: "Available floors", value: published?.floor ?? building.available_floors.join(", ") },
    { label: "Available area", value: `${(published?.marketed_area_py ?? building.marketed_area_py).toLocaleString("en-US")} py` },
    { label: "Availability", value: building.availability },
    ...(published ? [
      { label: "Rent-free", value: `${published.rent_free_months.toLocaleString("en-US")} months` },
      { label: "Supported parking", value: `${published.supported_parking_spaces.toLocaleString("en-US")} spaces` },
    ] : []),
    { label: "Latest update", value: formatBuildingChangedAt(building.latest_changed_at) },
  ];
}

function LatestBuildingDetails({ building, published }: { building: PublicBuildingSummary; published?: MobilePublishedSnapshot }) {
  return <dl className="lf-home-detail-list">{latestBuildingDetails(building, published).map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}

function ApprovedReferenceDocuments({ buildingId, documents }: {
  buildingId: string;
  documents: readonly PublishedDocumentReference[];
}) {
  const references = publishedDocumentsForBuilding(documents, buildingId);
  if (!references.length) return null;
  const headingId = `approved-reference-documents-${buildingId}`;
  return <section className="lf-building-provenance" aria-labelledby={headingId}>
    <div className="lf-home-section-heading"><div><span>Senior published</span><h2 id={headingId}>Approved Reference Documents</h2></div><span className="lf-service-status">Not official leasing terms</span></div>
    <p className="lf-building-provenance__note">These documents provide additional building context and remain separate from the published leasing terms and floor-plan facts.</p>
    <ul className="lf-service-list">{references.map((document) => <li key={`${document.building_id}-${document.document_type}-${document.reviewed_summary}`}><div><strong>{publishedDocumentTypeLabel(document.document_type)}</strong><span>{document.reviewed_summary}</span></div></li>)}</ul>
  </section>;
}

function BuildingSummaryFacts({ building }: { building: PublicBuildingSummary }) {
  return <dl className="lf-building-summary-facts">
    <div><dt>Available floors</dt><dd>{building.available_floors.length} floors · {building.available_floors.join(", ")}</dd></div>
    <div><dt>Available area</dt><dd>{building.marketed_area_py.toLocaleString("en-US")} py</dd></div>
    <div><dt>Availability</dt><dd>{building.availability}</dd></div>
  </dl>;
}

function formatBuildingChangedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Update date required";
  return `Updated ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(date)}`;
}

function BuildingIndexHeader({ disabled, query, setQuery }: { disabled: boolean; query: string; setQuery: (value: string) => void }) {
  return <header className="lf-building-index-header">
    <h1 tabIndex={-1}>Buildings</h1>
    <label className="lf-building-search"><span className="lf-visually-hidden">Search buildings</span><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg><input disabled={disabled} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by building, landlord, or market" /></label>
  </header>;
}

function ConfirmedHomeResult({
  intent,
  published,
  reports,
  weeklyTargetCount,
  weeklyAttentionCount,
}: {
  intent: HomeIntent;
  published: MobilePublishedSnapshot;
  reports: readonly PublicReport[];
  weeklyTargetCount: number;
  weeklyAttentionCount: number;
}) {
  if (intent === "weekly_review") return <WeeklyHomeResult reports={reports} targetCount={weeklyTargetCount} attentionCount={weeklyAttentionCount} />;
  if (intent === "package_prepare") {
    return <div className="lf-service-next"><h3>Prepare a package for {published.building_name}</h3><p>Continue from request review through approval using the current facts and floor plan.</p><Link className="lf-admin-button" href="/work">Open Requests</Link></div>;
  }
  return <>
    <CurrentFacts published={published} />
    <div className="lf-service-file"><div><span>Current floor plan</span><strong>{published.floor_plan.filename}</strong></div><a className="lf-admin-button lf-admin-button--secondary" href={published.floor_plan.download_url}>View Floor Plan</a></div>
    <div className="lf-service-next"><h3>Next Action</h3><Link className="lf-admin-button" href="/work">Prepare Customer Package</Link><Link href={`/buildings/${encodeURIComponent(published.building_id)}`}>View Building Details</Link></div>
  </>;
}

function HomeRequestActions({
  published,
  reports,
  weeklyTargetCount,
  weeklyAttentionCount,
  result,
  setResult,
}: {
  published: MobilePublishedSnapshot;
  reports: readonly PublicReport[];
  weeklyTargetCount: number;
  weeklyAttentionCount: number;
  result: HomeRequestResult;
  setResult: (next: HomeRequestResult | null) => void;
}) {
  if (!result.matched) {
    return <div className="lf-service-next"><h3>Check the building, floor, and information requested.</h3><button className="lf-admin-button lf-admin-button--secondary" type="button" onClick={() => setResult(null)}>Rewrite Request</button></div>;
  }
  if (!result.confirmed) {
    return <div className="lf-service-next"><h3>Is this request correct?</h3><button className="lf-admin-button" type="button" onClick={() => setResult({ ...result, confirmed: true })}>Confirm and Continue</button><button className="lf-admin-button lf-admin-button--secondary" type="button" onClick={() => setResult(null)}>Edit Request</button></div>;
  }
  return <ConfirmedHomeResult intent={result.intent} published={published} reports={reports} weeklyTargetCount={weeklyTargetCount} weeklyAttentionCount={weeklyAttentionCount} />;
}

function useOperationsSnapshot() {
  const { actorId } = useAdminData();
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const snapshotRef = useRef<OperationsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadSequence = useRef(0);
  const replaceSnapshot = useCallback((next: OperationsSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    setError(null);
  }, []);

  const load = useCallback(async (): Promise<OperationsSnapshot | null> => {
    const sequence = ++loadSequence.current;
    try {
      const next = await loadOperationsSnapshot(actorId);
      if (sequence !== loadSequence.current) return null;
      replaceSnapshot(next);
      return next;
    } catch {
      if (sequence === loadSequence.current) {
        snapshotRef.current = null;
        setSnapshot(null);
        setError("The latest workspace data could not be loaded. Published information was not changed.");
      }
      return null;
    }
  }, [actorId, replaceSnapshot]);

  const act = useCallback(async (action: Record<string, unknown>): Promise<void> => {
    const current = snapshotRef.current;
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await performOperationsWorkflowAction(current.workflow, actorId, action);
      if (!await load()) throw new Error("refresh failed");
    } catch {
      setError("This action is unavailable to the current role, or the data changed first. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  }, [actorId, busy, load]);

  useEffect(() => {
    snapshotRef.current = null;
    setSnapshot(null);
    void load();
  }, [load]);

  return { act, actorId, busy, error, load, replaceSnapshot, snapshot };
}

export function ServiceHome() {
  const { actorId, error, load, snapshot } = useOperationsSnapshot();
  const [request, setRequest] = useState("");
  const [submitted, setSubmitted] = useState<HomeRequestResult | null>(null);
  const [weeklyGroups, setWeeklyGroups] = useState<WeeklyOperationalGroupsProjection | null>(null);
  const [weeklyGroupsLoaded, setWeeklyGroupsLoaded] = useState(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    setWeeklyGroupsLoaded(false);
    void loadWeeklyGroups(actorId).then((groups) => {
      if (active) setWeeklyGroups(groups);
    }).catch(() => {
      if (active) setWeeklyGroups(null);
    }).finally(() => {
      if (active) setWeeklyGroupsLoaded(true);
    });
    return () => { active = false; };
  }, [actorId]);

  useEffect(() => {
    if (!submitted) return;
    const frame = window.requestAnimationFrame(() => {
      resultHeadingRef.current?.focus({ preventScroll: true });
      resultHeadingRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [submitted]);

  if (!snapshot) return error ? <><PageHeader title="Workspace" /><ErrorPanel message={error} retry={() => void load()} /></> : <LoadingPage title="Workspace" />;
  const { published } = snapshot;
  const currentRequest = snapshot.workflow.requests.at(-1);
  const currentPackage = snapshot.workflow.packages.at(-1);
  const isAwaitingPublication = currentRequest?.status === "confirmed"
    && !currentPackage
    && snapshot.workflow.publication_stage !== "published";
  const workAction = isAwaitingPublication
    ? { label: "Review building update", state: "Awaiting publication", completed: false }
    : nextWorkAction(currentRequest, currentPackage);
  const hasActiveWork = Boolean(currentRequest || currentPackage) && !workAction.completed;
  const handledCount = snapshot.workflow.packages.filter((item) => item.status === "sent").length;
  const reportAttention = weeklyAttentionCount(snapshot.reports.reports, weeklyGroups);
  const configuredWeekly = weeklyGroups?.groups.flatMap((group) => group.reports.map((building) => ({ ...building, landlord_name: group.landlord_name }))) ?? [];
  const primaryWeeklyGroup = weeklyGroups?.groups.at(0) ?? null;
  const primaryWeeklyReports = primaryWeeklyGroup ? reportsForGroup(primaryWeeklyGroup, snapshot.reports.reports) : [];
  const completedWeeklyReports = primaryWeeklyReports.filter((report) => report.status === "sent").length;
  const actor = demoUsers.find((user) => user.id === actorId);
  const canReviewBuildingUpdate = actor ? canPerform(actor.role, "source.upload") : false;
  const workHref = isAwaitingPublication && canReviewBuildingUpdate ? "/building-updates" : "/work";
  const updateHref = canReviewBuildingUpdate ? "/building-updates" : `/buildings/${encodeURIComponent(published.building_id)}`;

  return <>
    <h1 className="lf-visually-hidden" tabIndex={-1}>Workspace</h1>
    <section className="lf-home-command" aria-label="Natural-language work request">
      <form className="lf-home-composer" onSubmit={(event) => {
          event.preventDefault();
          if (!request.trim()) return;
          setSubmitted({ text: request.trim(), confirmed: false, ...interpretHomeRequest(request, published) });
        }}>
        <label className="lf-visually-hidden" htmlFor="task-command">Find information or prepare work</label>
        <textarea
            id="task-command"
            placeholder="What would you like to find or prepare?"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
        />
        <div>
          <button aria-label="Use voice input" onClick={() => setRequest(`Find the latest area and floor plan for ${published.building_name} ${published.floor}.`)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg></button>
          <button aria-label="Submit request" className="is-send" disabled={!request.trim()} type="submit"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/></svg></button>
        </div>
      </form>
    </section>
    {submitted ? <section className="lf-service-result" aria-live="polite" aria-labelledby="request-result-title">
      <div className="lf-service-result__confirm"><span>{homeRequestStatus(submitted)}</span><h2 ref={resultHeadingRef} tabIndex={-1} id="request-result-title">{submitted.matched ? homeRequestUnderstanding(submitted.intent, published) : submitted.message}</h2><p>“{submitted.text}”</p></div>
      <HomeRequestActions published={published} reports={snapshot.reports.reports} weeklyTargetCount={configuredWeekly.length} weeklyAttentionCount={reportAttention} result={submitted} setResult={setSubmitted} />
    </section> : null}
    <section className="lf-home-overview" aria-label="Work summary">
      <article className="lf-home-summary lf-home-summary--work" aria-labelledby="home-work-title">
        <header><span>Active Request</span><strong>{hasActiveWork ? "1" : "None"}</strong></header>
        <div className="lf-home-summary__body">
          <div className="lf-home-summary__title">
            <h2 id="home-work-title">{hasActiveWork ? workAction.label : "Waiting for a new customer request"}</h2>
            <span className="lf-service-status">{hasActiveWork ? workAction.state : "Ready"}</span>
          </div>
          <p>{published.building_name} · {currentRequest?.summary.floor ?? published.floor}</p>
          <dl className="lf-home-summary__facts">
            <div><dt>Deadline</dt><dd>{hasActiveWork ? formatRequestDeadline(currentRequest?.summary.deadline ?? null) : "Shown when a request is imported"}</dd></div>
            <div><dt>Current source</dt><dd>{published.floor_plan.filename}</dd></div>
            <div><dt>Completed today</dt><dd>{handledCount}</dd></div>
          </dl>
        </div>
        <footer><Link href={workHref}>{hasActiveWork ? workAction.label : "View Requests"}<span aria-hidden="true">→</span></Link></footer>
      </article>

      <article className="lf-home-summary lf-home-summary--updates" aria-labelledby="home-updates-title">
        <header><span>Building Update</span><strong>{demoSourceUpdate.changes.length} changes</strong></header>
        <div className="lf-home-summary__body">
          <div className="lf-home-summary__title">
            <h2 id="home-updates-title">{published.building_name} · {published.floor}</h2>
            <span className="lf-service-status">{published.publication_stage === "published" ? "Published" : "In review"}</span>
          </div>
          <p>Effective {formatDate(demoSourceUpdate.effectiveDate)}</p>
          <ul className="lf-home-update-preview">{demoSourceUpdate.changes.slice(0, 2).map((change) => <li key={change.field}><span>{fieldLabels[change.field] ?? "Changed field"}</span><strong>{formatChangeValue(change.field, change.previous)} → {formatChangeValue(change.field, change.proposed)}</strong></li>)}</ul>
        </div>
        <footer><Link href={updateHref}>{canReviewBuildingUpdate ? "Review Changes" : "View Building"}<span aria-hidden="true">→</span></Link></footer>
      </article>

      <article className="lf-home-summary lf-home-summary--weekly" aria-labelledby="home-weekly-title">
        <header><span>Weekly Reports</span><strong>{weeklyGroupsLoaded ? `${reportAttention} to review` : "Loading"}</strong></header>
        <div className="lf-home-summary__body">
          <div className="lf-home-summary__title">
            <h2 id="home-weekly-title">{primaryWeeklyGroup?.landlord_name ?? "No report schedule"}</h2>
            <span className="lf-service-status">Next meeting</span>
          </div>
          <p>{weeklyGroupsLoaded ? formatWeeklyMeeting(primaryWeeklyGroup) : "Loading schedule"}</p>
          <dl className="lf-home-summary__facts lf-home-summary__facts--compact">
            <div><dt>Buildings</dt><dd>{primaryWeeklyGroup?.reports.length ?? 0}</dd></div>
            <div><dt>Completed</dt><dd>{completedWeeklyReports}/{primaryWeeklyGroup?.reports.length ?? 0}</dd></div>
          </dl>
        </div>
        <footer><Link href="/weekly">Review Weekly Reports<span aria-hidden="true">→</span></Link></footer>
      </article>
    </section>
  </>;
}

function WeeklyHomeResult({ reports, targetCount, attentionCount }: { reports: readonly PublicReport[]; targetCount: number; attentionCount: number }) {
  const totalCount = Math.max(reports.length, targetCount);
  return <div className="lf-service-next"><h3>{totalCount} building reports this week</h3><p>{attentionCount ? `${attentionCount} reports still require review or approval.` : "All weekly reports are ready."}</p><Link className="lf-admin-button" href="/weekly">Review Weekly Reports</Link></div>;
}

export function BuildingsPage() {
  const { error, load, snapshot } = useOperationsSnapshot();
  const [query, setQuery] = useState("");
  const header = <BuildingIndexHeader disabled={!snapshot} query={query} setQuery={setQuery} />;
  if (!snapshot) return error ? <>{header}<ErrorPanel message={error} retry={() => void load()} /></> : <>{header}<div className="lf-admin-skeleton" aria-busy="true" aria-label="Loading buildings"><span /><span /><span /></div></>;
  const buildings = filterAndSortBuildings(snapshot.buildings, query);
  const hasQuery = query.trim().length > 0;
  return <>{header}
    <section aria-labelledby="building-list-title"><div className="lf-admin-section-heading"><h2 id="building-list-title">{hasQuery ? "Search Results" : "Recently Updated Buildings"}</h2><span>{buildings.length} buildings</span></div>{buildings.length ? <ul className="lf-building-index-list">{buildings.map((building) => <li key={building.building_id}><article className="lf-building-card"><div className="lf-building-card__identity"><div><span className="lf-service-status">{formatBuildingChangedAt(building.latest_changed_at)}</span><span>{building.market}</span></div><h3>{building.building_name}</h3><p>Landlord · {building.landlord_name}</p></div><BuildingSummaryFacts building={building} /><Link className="lf-admin-button" href={`/buildings/${encodeURIComponent(building.building_id)}`}>View Details</Link></article></li>)}</ul> : <div className="lf-service-state"><h3>No buildings found</h3><p>Check the building, landlord, or market and try again.</p><button className="lf-admin-button lf-admin-button--secondary" onClick={() => setQuery("")} type="button">Clear Search</button></div>}</section>
  </>;
}

export function BuildingDetailPage({ buildingRef }: { buildingRef: string }) {
  const { actorId, error, load, snapshot } = useOperationsSnapshot();
  const backAction = <Link className="lf-admin-button lf-admin-button--secondary" href="/buildings">← Back to Buildings</Link>;
  if (!snapshot) return error ? <><PageHeader title="Building Details" /><ErrorPanel message={error} retry={() => void load()} /></> : <LoadingPage title="Building Details" />;
  const { published } = snapshot;
  const building = snapshot.buildings.find((candidate) => candidate.building_id === buildingRef);
  if (!building || !snapshot.scope.building_ids.includes(buildingRef)) return <><PageHeader action={backAction} title="Building Not Found" /><div className="lf-service-state"><h2>This building is not available to the current role.</h2><Link className="lf-admin-button" href="/buildings">Back to Buildings</Link></div></>;
  if (buildingRef !== published.building_id) return <><PageHeader action={backAction} title={building.building_name} />
    <section className="lf-building-hero"><div><span className="lf-service-status">Available now</span><h2>{building.available_floors.join(", ")} Leasing Information</h2><p>{formatBuildingChangedAt(building.latest_changed_at)} · Landlord {building.landlord_name}</p></div><BuildingSummaryFacts building={building} /></section>
    <section className="lf-building-provenance" aria-labelledby="building-current-title"><div className="lf-home-section-heading"><h2 id="building-current-title">Current Leasing Information</h2></div><LatestBuildingDetails building={building} /></section>
    <ApprovedReferenceDocuments buildingId={building.building_id} documents={snapshot.published_documents} />
    <div className="lf-service-split"><section aria-labelledby="building-work-title"><h2 id="building-work-title">Connected Work</h2><p>Use the current leasing information for weekly reports and customer packages.</p></section><aside className="lf-service-action"><h2>Weekly Reports</h2><Link className="lf-admin-button" href="/weekly">Review Reports</Link></aside></div>
  </>;
  const evidenceDate = published.source_assets.map((asset) => asset.artifact_date).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const originalSourceUrl = `/api/buildings/source?actor_id=${encodeURIComponent(actorId)}&building_id=${encodeURIComponent(building.building_id)}`;
  return <><PageHeader action={backAction} title={published.building_name} />
    <section className="lf-building-hero"><div><span className="lf-service-status">Available now</span><h2>{published.floor} Leasing Information</h2><p>Current publication · {evidenceDate ? `as of ${formatDate(evidenceDate)}` : "based on approved sources"}</p></div><CurrentFacts published={published} /></section>
    <section className="lf-building-provenance" aria-labelledby="building-current-title"><div className="lf-home-section-heading"><h2 id="building-current-title">Current Leasing Information</h2></div><LatestBuildingDetails building={building} published={published} /></section>
    <ApprovedReferenceDocuments buildingId={published.building_id} documents={snapshot.published_documents} />
    <div className="lf-service-split"><section aria-labelledby="plans-title"><h2 id="plans-title">Source Files</h2><ul className="lf-service-list">{snapshot.publication_stage === "published" ? <li><div><strong>Uploaded leasing source</strong><span>Original file used for the current information</span></div><a download href={originalSourceUrl}>Download Source</a></li> : null}<li><div><strong>{published.floor} current floor plan</strong><span>{published.floor_plan.filename}</span></div><a download href={published.floor_plan.download_url}>Download Floor Plan</a></li></ul></section><aside className="lf-service-action"><h2>Prepare Customer Package</h2><p>Use the current published information and floor plan.</p><Link className="lf-admin-button" href="/work">Prepare Package</Link></aside></div>
  </>;
}

export function WorkPage() {
  const { act, actorId, busy, error, load, snapshot } = useOperationsSnapshot();
  if (!snapshot) return error ? <><PageHeader title="Requests" /><ErrorPanel message={error} retry={() => void load()} /></> : <LoadingPage title="Requests" />;
  const { published, workflow } = snapshot;
  const request = workflow.requests.at(-1); const pkg = workflow.packages.at(-1);
  const actor = demoUsers.find((user) => user.id === actorId);
  const canPrepare = actor ? canPerform(actor.role, "package.prepare") : false;
  const canApprove = actor ? canPerform(actor.role, "package.approve") : false;
  const canSend = actor ? canPerform(actor.role, "package.send") : false;
  const isAwaitingPublication = request?.status === "confirmed" && !pkg && workflow.publication_stage !== "published";
  const currentProgressIndex = workflowProgressIndex(request, pkg);
  let packageAction: ReactNode = null;
  if (pkg?.status === "draft") {
    packageAction = <button className="lf-admin-button" disabled={busy || !canApprove} onClick={() => void act({ action: "approve", package_id: pkg.id })} type="button">Review and Approve</button>;
  } else if (pkg?.status === "approved") {
    packageAction = <button className="lf-admin-button" disabled={busy || !canSend} onClick={() => void act({ action: "send", package_id: pkg.id, idempotency_key: `web-sandbox-${pkg.id}` })} type="button">Confirm and Record Delivery</button>;
  } else if (pkg?.status === "sent") {
    packageAction = <p className="lf-admin-feedback lf-admin-feedback--success">Delivery was recorded. No real email was sent.</p>;
  }
  return <><PageHeader title="Requests" />{error ? <div className="lf-admin-feedback lf-admin-feedback--error" role="alert"><h3>Action could not be completed</h3><p>{error}</p></div> : null}
    {!canPrepare && !canApprove && !canSend ? <section className="lf-service-state"><h2>This role has view-only access.</h2><p>Request review, package approval, and delivery records depend on the assigned role.</p></section> : null}
    <ol className="lf-service-progress" aria-label="Customer package workflow">{["Import Request", "Review Request", "Prepare Package", "Human Approval", "Delivery Record"].map((label, index) => <li key={label} className={currentProgressIndex >= index ? "is-current" : ""}><span>{index + 1}</span>{label}</li>)}</ol>
    {!request ? <section className="lf-service-work-card"><div className="lf-service-title-row"><h2>Import a customer request</h2><span className="lf-service-status">New task</span></div><p>Load a synthetic call or email request and review the extracted details.</p><button className="lf-admin-button" disabled={busy || !canPrepare} onClick={() => void act({ action: "import", source: "call" })} type="button">Import Call Request</button></section> : null}
    {request && !pkg ? <section className="lf-service-work-card"><div className="lf-service-title-row"><h2>{published.building_name} · {request.summary.floor ?? "Floor required"} Package Request</h2><span className="lf-service-status">{request.status === "candidate" ? "Review required" : isAwaitingPublication ? "Awaiting publication" : "Confirmed"}</span></div><dl className="lf-service-request"><div><dt>Information</dt><dd>{request.summary.requested_fields.length ? request.summary.requested_fields.map(requestFieldLabel).join(", ") : "Additional review required"}</dd></div><div><dt>Files</dt><dd>{request.summary.requested_files.length ? request.summary.requested_files.map(requestFileLabel).join(", ") : "Additional review required"}</dd></div><div><dt>Requester</dt><dd>{request.summary.recipient.name ?? "Review required"} · {request.summary.recipient.organization ?? "Organization required"}</dd></div><div><dt>Deadline</dt><dd>{formatRequestDeadline(request.summary.deadline)}</dd></div></dl>{request.status === "candidate" ? <button className="lf-admin-button" disabled={busy || !canPrepare} onClick={() => void act({ action: "confirm", request_id: request.id })} type="button">Confirm Request</button> : isAwaitingPublication ? <div className="lf-admin-feedback lf-admin-feedback--warning" role="status"><h3>New building information is under review.</h3><p>The package can be prepared with the current facts and floor plan after publication.</p><Link className="lf-admin-button" href="/building-updates">Review Building Data</Link></div> : <button className="lf-admin-button" disabled={busy || !canPrepare} onClick={() => void act({ action: "draft", request_id: request.id })} type="button">Prepare Package</button>}</section> : null}
    {pkg ? <section className="lf-service-work-card"><div className="lf-service-title-row"><h2>{pkg.subject}</h2><span className="lf-service-status">{packageLabels[pkg.status]}</span></div><div className="lf-service-package"><div><h3>Message</h3><p>{pkg.body}</p></div><div><h3>Included Materials</h3><ul>{pkg.facts.map((fact, index) => <li key={`${fact.label}-${index}`}>{requestFieldLabel(fact.label)} {fact.value}{unitLabels[fact.unit] ?? ""}</li>)}{pkg.files.map((file) => <li key={file.filename}>Current floor plan · {file.filename}</li>)}</ul></div><div><h3>Recipients</h3><p>{pkg.recipients.to.join(", ")}</p></div></div>{packageAction}</section> : null}
  </>;
}

export async function loadWeeklyGroups(actorId: string, fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch): Promise<WeeklyOperationalGroupsProjection> {
  const response = await fetcher(`/api/weekly-groups?actor_id=${encodeURIComponent(actorId)}`, { cache: "no-store" });
  const result = await response.json() as WeeklyOperationalGroupsProjection & { error?: string };
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function draftWeeklyBuildingReport(
  snapshot: OperationsSnapshot,
  actorId: string,
  buildingId: string,
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<{ snapshot: OperationsSnapshot; groups: WeeklyOperationalGroupsProjection }> {
  const response = await fetcher("/api/mobile/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "draft",
      actor_id: actorId,
      expected_revision: snapshot.reports.revision,
      building_id: buildingId,
    }),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error);
  const [nextSnapshot, groups] = await Promise.all([
    loadOperationsSnapshot(actorId, fetcher),
    loadWeeklyGroups(actorId, fetcher),
  ]);
  return { snapshot: nextSnapshot, groups };
}

export function reportsForGroup(group: WeeklyOperationalGroup, reports: readonly PublicReport[]): PublicReport[] {
  const buildingIds = new Set(group.reports.map((report) => report.building_id));
  return reports.filter((report) => buildingIds.has(report.building_id));
}

export function weeklyChildrenForGroup(group: WeeklyOperationalGroup, reports: readonly PublicReport[]) {
  return group.reports.map((building) => ({
    ...building,
    report: reports.find((report) => report.building_id === building.building_id) ?? null,
  }));
}

function WeeklyGroup({
  busyBuildingId,
  canDraft,
  canManage,
  group,
  onDraft,
  reports,
}: {
  busyBuildingId: string | null;
  canDraft: boolean;
  canManage: boolean;
  group: WeeklyOperationalGroup | null;
  onDraft: (buildingId: string) => Promise<void>;
  reports: readonly PublicReport[];
}) {
  const title = group?.landlord_name ?? "Building Weekly Reports";
  const children = group ? weeklyChildrenForGroup(group, reports) : reports.map((report) => ({ building_id: report.building_id, building_name: report.building_label, report }));
  const readyCount = children.filter((child) => child.report).length;
  return <section className="lf-landlord-group" aria-labelledby={`landlord-${group?.group_ref ?? "unassigned"}`}>
    <header>
      <div><span className="lf-service-eyebrow">{group ? "Landlord" : "Report group required"}</span><h2 id={`landlord-${group?.group_ref ?? "unassigned"}`}>{title}</h2>{group ? <p>{weeklyCadenceLabels[group.cadence]} · {formatWeeklyMeeting(group)}</p> : null}</div>
      <div className="lf-weekly-group-actions"><span className="lf-service-status">{readyCount}/{children.length} ready</span>{group && canManage ? <Link href={`/weekly-settings/${encodeURIComponent(group.group_ref)}`}>Edit Settings</Link> : null}</div>
    </header>
    {group ? <div className="lf-weekly-automation-summary">
      <dl><div><dt>Owner</dt><dd>{group.owner_name}</dd></div><div><dt>Final approver</dt><dd>{group.approver_name}</dd></div><div><dt>Coverage</dt><dd>Last {group.automation.aggregation_days} days</dd></div><div><dt>Required sections</dt><dd>{group.automation.required_section_keys.length}</dd></div></dl>
      <ul aria-label="Automation schedule">{weeklyAutomationSummary(group.automation).map((checkpoint) => <li key={checkpoint}>{checkpoint}</li>)}</ul>
      <p><span>Report sections</span>{group.automation.required_section_keys.map((key) => weeklyReportSectionLabels[key]).join(" · ")}</p>
    </div> : null}
    {children.length ? <ul className="lf-weekly-buildings">{children.map((child) => <li key={child.building_id}><div><h3>{child.report?.building_label ?? child.building_name}</h3>{child.report ? <p><time dateTime={child.report.reporting_period.from}>{formatDate(child.report.reporting_period.from)}</time>–<time dateTime={child.report.reporting_period.to}>{formatDate(child.report.reporting_period.to)}</time></p> : <p>This week's report has not been prepared.</p>}</div><span>{child.report ? reportLabels[child.report.status] : "Not prepared"}</span>{child.report ? <Link className="lf-admin-button" href={`/weekly/${encodeURIComponent(child.report.id)}`}>Review Building Report</Link> : canDraft ? <button className="lf-admin-button" disabled={busyBuildingId !== null} onClick={() => void onDraft(child.building_id)} type="button">{busyBuildingId === child.building_id ? "Preparing…" : "Prepare Building Report"}</button> : <span>Waiting for owner</span>}</li>)}</ul> : <div className="lf-service-state"><h3>No buildings are connected.</h3><p>Connect a landlord and buildings in Report Automation first.</p></div>}
  </section>;
}

export function WeeklyPage() {
  const { actorId, error, load, replaceSnapshot, snapshot } = useOperationsSnapshot();
  const [weeklyGroups, setWeeklyGroups] = useState<WeeklyOperationalGroupsProjection | null>(null);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [busyBuildingId, setBusyBuildingId] = useState<string | null>(null);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setGroupsLoaded(false);
    void loadWeeklyGroups(actorId).then((next) => {
      if (active) setWeeklyGroups(next);
    }).catch(() => {
      if (active) setWeeklyGroups(null);
    }).finally(() => {
      if (active) setGroupsLoaded(true);
    });
    return () => { active = false; };
  }, [actorId]);
  if (!snapshot) return error ? <><PageHeader title="Weekly Reports" /><ErrorPanel message={error} retry={() => void load()} /></> : <LoadingPage title="Weekly Reports" />;
  if (!groupsLoaded) return <LoadingPage title="Weekly Reports" />;
  const scopedReports = snapshot.reports.reports.filter((report) => snapshot.scope.building_ids.includes(report.building_id));
  const groups = (weeklyGroups?.groups ?? []).map((group) => ({ group, reports: reportsForGroup(group, scopedReports) }));
  const assignedReportIds = new Set(groups.flatMap((entry) => entry.reports.map((report) => report.id)));
  const unassigned = scopedReports.filter((report) => !assignedReportIds.has(report.id));
  const canDraft = snapshot.reports.allowedActions.includes("draft");
  async function draftBuilding(buildingId: string) {
    if (busyBuildingId || !snapshot) return;
    setBusyBuildingId(buildingId);
    setWeeklyError(null);
    try {
      const refreshed = await draftWeeklyBuildingReport(snapshot, actorId, buildingId);
      replaceSnapshot(refreshed.snapshot);
      setWeeklyGroups(refreshed.groups);
    } catch {
      setWeeklyError("The building report could not be prepared. Refresh and try again.");
    } finally {
      setBusyBuildingId(null);
    }
  }
  const canManage = weeklyGroups?.can_manage_settings ?? false;
  return <><PageHeader title="Weekly Reports" action={canManage ? <Link className="lf-admin-button" href="/weekly-settings">Configure</Link> : undefined} />{weeklyError ? <div className="lf-admin-feedback lf-admin-feedback--error" role="alert"><h2>Report preparation could not be completed</h2><p>{weeklyError}</p></div> : null}<div className="lf-weekly-automation-list">{groups.map(({ group, reports }) => <WeeklyGroup key={group.group_ref} busyBuildingId={busyBuildingId} canDraft={canDraft} canManage={canManage} group={group} onDraft={draftBuilding} reports={reports} />)}{unassigned.length || !groups.length ? <WeeklyGroup busyBuildingId={busyBuildingId} canDraft={false} canManage={canManage} group={null} onDraft={draftBuilding} reports={unassigned} /> : null}</div></>;
}

export function WeeklyReportDetailPage({ reportRef }: { reportRef: string }) {
  const { actorId, error, load, replaceSnapshot, snapshot } = useOperationsSnapshot();
  const [busy, setBusy] = useState<WeeklyDetailBusy | null>(null);
  const [notice, setNotice] = useState<WeeklyDetailNotice | null>(null);

  if (!snapshot) return error ? <><PageHeader title="Building Weekly Report" /><ErrorPanel message={error} retry={() => void load()} /></> : <LoadingPage title="Building Weekly Report" />;
  const report = selectReportByRef(snapshot.reports.reports, reportRef);
  if (!report || !snapshot.scope.building_ids.includes(report.building_id)) {
    return <><PageHeader title="Weekly Report Not Found" /><section className="lf-service-state"><h2>This report is not available to the current role.</h2><Link className="lf-admin-button" href="/weekly">Back to Weekly Reports</Link></section></>;
  }
  const reportId = report.id;

  async function mutate(action: WeeklyDetailAction, decision?: "accept" | "reject") {
    if (!snapshot || busy) return;
    const nextBusy = weeklyBusyAction(action, decision);
    if (!nextBusy) return;
    setBusy(nextBusy);
    setNotice(null);
    try {
      const refreshed = await performWeeklyReportAction(snapshot, actorId, reportId, action, decision);
      const refreshedReport = selectReportByRef(refreshed.reports.reports, reportId);
      if (!refreshedReport) throw new Error("report missing after refresh");
      replaceSnapshot(refreshed);
      setNotice({ tone: "success", message: weeklyActionSuccessMessage(action, decision) });
    } catch {
      setNotice({ tone: "error", message: "The action could not be completed. Refresh and try again." });
    } finally {
      setBusy(null);
    }
  }

  return <ReportDetail
    allowedActions={new Set(snapshot.reports.allowedActions)}
    busy={busy}
    mutate={mutate}
    notice={notice}
    reload={async () => { await load(); }}
    report={report}
  />;
}
