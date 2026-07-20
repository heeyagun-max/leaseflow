"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useAdminData } from "@/components/governance/admin-data";
import styles from "./building-updates.module.css";

type Step = "자료 올리기" | "변경 확인" | "담당자 확인" | "최종 확인" | "최신정보 반영";
type Action = "register" | "confirm" | "publish" | "review_document" | "publish_document";
type DocumentType = "monthly_owner_update" | "floor_plan" | "leasing_flyer" | "area_workbook" | "legal_document";
type DocumentReviewPolicy = "publishable_reference" | "review_only" | "manual_review";

interface ReviewedCandidate {
  summary: string;
  facts: Array<{ label: string; value: string }>;
}

type DocumentAnalysis = {
  status: "candidate_ready";
  candidate_count: number;
  analyzed_at: string;
  source_format: "json" | "pdf" | "xlsx" | "docx";
  reviewed_candidate?: ReviewedCandidate;
} | {
  status: "manual_review";
  analyzed_at: string;
  source_format: "pdf" | "dwg";
};

interface DocumentAsset {
  id: string;
  building_id: string | null;
  document_type: DocumentType;
  source_format: "json" | "pdf" | "xlsx" | "docx" | "dwg";
  review_policy: DocumentReviewPolicy;
  reviewed_summary: string | null;
  status: string;
}

interface BuildingUpdateProjection {
  version: number;
  updateRef: string;
  buildingName: string;
  effectiveDate: string;
  sourceOrganization: string;
  selectedFile: { key: string; filename: string; label: string };
  availableFiles: Array<{ key: string; filename: string; label: string }>;
  availableBuildings: Array<{ id: string; name: string }>;
  documentTypes: Array<{ value: DocumentType; label: string; accept: string }>;
  documentType: DocumentType;
  uploadedFile: { original_filename: string; byte_size: number } | null;
  analysis: DocumentAnalysis | null;
  documentAsset: DocumentAsset | null;
  step: Step;
  canStartNewUpload: boolean;
  allowedActions: Action[];
  changes: Array<{ label: string; before: string; after: string }>;
  currentFacts: Array<{ label: string; value: string; from: string }>;
  currentFiles: Array<{ filename: string; from: string }>;
  history: Array<{ buildingName: string; label: string; value: string; updatedAt: string; from: string; to: string | null; current: boolean }>;
}

const steps: Step[] = ["자료 올리기", "변경 확인", "담당자 확인", "최종 확인", "최신정보 반영"];
const stepLabels: Record<Step, string> = {
  "자료 올리기": "Upload Source",
  "변경 확인": "Review Changes",
  "담당자 확인": "Data Steward Review",
  "최종 확인": "Senior Approval",
  "최신정보 반영": "Published",
};

function documentTypeDisplayLabel(type: DocumentType): string {
  if (type === "monthly_owner_update") return "Monthly owner update";
  if (type === "floor_plan") return "Floor plan";
  if (type === "leasing_flyer") return "Leasing flyer";
  if (type === "area_workbook") return "Area workbook";
  return "Contract or legal document";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(`${value}T00:00:00+09:00`));
}

function fileSizeLabel(value: number) {
  return value < 1024 ? `${value}B` : `${Math.max(1, Math.round(value / 1024))}KB`;
}

function PageHeader({ title }: { title: string }) {
  return <header className="lf-admin-page-header"><h1 tabIndex={-1}>{title}</h1></header>;
}

function Notice({ children, tone = "info" }: { children: string; tone?: "error" | "info" | "success" }) {
  return <div className={`lf-admin-feedback lf-admin-feedback--${tone}`} role={tone === "error" ? "alert" : "status"}><p>{children}</p></div>;
}

function Progress({ current }: { current: Step }) {
  const currentIndex = steps.indexOf(current);
  return <ol className={styles.progress} aria-label="Publication workflow">{steps.map((step, index) => <li className={index <= currentIndex ? styles.reached : undefined} key={step} aria-current={step === current ? "step" : undefined}>{stepLabels[step]}</li>)}</ol>;
}

function DocumentProgress({ asset }: { asset: DocumentAsset }) {
  const reviewed = asset.status === "reviewed" || asset.status === "steward_confirmed";
  const labels = asset.review_policy === "manual_review"
    ? ["Upload Source", "Manual Review Required"]
    : asset.review_policy === "review_only"
      ? ["Upload Source", "Data Steward Review", "Internal Review Complete"]
      : ["Upload Source", "Data Steward Review", "Senior Publication", "Approved Reference"];
  const currentIndex = asset.review_policy === "manual_review"
    ? 1
    : asset.status === "published"
      ? labels.length - 1
      : reviewed
        ? Math.min(2, labels.length - 1)
        : 1;
  return <ol className={`${styles.progress} ${styles.documentProgress}`} aria-label="Reference document review workflow">{labels.map((label, index) => <li className={index <= currentIndex ? styles.reached : undefined} key={label} aria-current={index === currentIndex ? "step" : undefined}>{label}</li>)}</ol>;
}

function documentStatusLabel(status: string) {
  if (status === "registered") return "Awaiting Data Steward review";
  if (status === "reviewed" || status === "steward_confirmed") return "Data Steward review complete";
  if (status === "published") return "Reference published";
  if (status === "superseded") return "Superseded";
  if (status === "duplicate") return "Duplicate";
  if (status === "rejected") return "Rejected";
  return "In review";
}

export function boundedReviewedCandidate(candidate: ReviewedCandidate | undefined): ReviewedCandidate | null {
  if (!candidate) return null;
  return {
    summary: candidate.summary.slice(0, 240),
    facts: candidate.facts.slice(0, 6).map((fact) => ({
      label: fact.label.slice(0, 40),
      value: fact.value.slice(0, 120),
    })),
  };
}

export function uploadAcceptForDocumentType(
  documentTypes: ReadonlyArray<{ value: DocumentType; accept: string }>,
  selected: DocumentType,
): string {
  return documentTypes.find((type) => type.value === selected)?.accept ?? "";
}

export function documentTerminalGuidance(asset: Pick<DocumentAsset, "review_policy" | "status">): string {
  if (asset.review_policy === "manual_review") {
    return "Automated review is unavailable for this file. Review the original manually. It cannot be published as official building information or an external reference.";
  }
  if (asset.review_policy === "review_only") {
    return asset.status === "registered"
      ? "This file is limited to internal review. After Data Steward review, it is retained internally and is not published as an external reference."
      : "Internal review is complete. This file is not published externally and does not update official building information.";
  }
  if (asset.status === "registered") return "Waiting for Data Steward review. The document cannot be published before review.";
  if (asset.status === "reviewed" || asset.status === "steward_confirmed") {
    return "Data Steward review is complete. Senior publication is required. This document does not update official building information.";
  }
  if (asset.status === "published") return "Published as an approved reference and kept separate from official leasing terms.";
  return "Ask the assigned owner for the current review result.";
}

function UpdateNav({ current }: { current: "list" | "new" | "history" }) {
  return <nav className="lf-admin-local-nav" aria-label="Building data intake views">
    <Link aria-current={current === "list" ? "page" : undefined} href="/building-updates">In Progress</Link>
    <Link aria-current={current === "new" ? "page" : undefined} href="/building-updates/new">Upload Source</Link>
    <Link aria-current={current === "history" ? "page" : undefined} href="/building-updates/history">Change History</Link>
  </nav>;
}

function Loading({ title }: { title: string }) {
  return <><PageHeader title={title} /><div className="lf-admin-skeleton" aria-busy="true"><span /><span /><span /></div></>;
}

export function BuildingUpdateConsole({ view, updateRef }: { view: "detail" | "history" | "list" | "new"; updateRef?: string }) {
  const { actorId, mutate: mutateDemo } = useAdminData();
  const router = useRouter();
  const [data, setData] = useState<BuildingUpdateProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadFilename, setUploadFilename] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType>("monthly_owner_update");
  const [reviewSummary, setReviewSummary] = useState("");

  const reload = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`/api/building-updates?actor_id=${encodeURIComponent(actorId)}`, { cache: "no-store" });
      const result = await response.json() as BuildingUpdateProjection & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setData(result);
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Building data could not be loaded.");
    }
  }, [actorId]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!data) return;
    setSelectedBuildingId(data.availableBuildings.find((building) => building.name === data.buildingName)?.id ?? data.availableBuildings[0]?.id ?? "");
    setSelectedDocumentType(data.documentType);
    setReviewSummary(data.documentAsset?.reviewed_summary
      ?? (data.analysis?.status === "candidate_ready" ? data.analysis.reviewed_candidate?.summary ?? "" : ""));
  }, [data]);

  async function mutate(body: Record<string, unknown>) {
    if (!data || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/building-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_id: actorId, expected_version: data.version, ...body }),
      });
      const result = await response.json() as BuildingUpdateProjection & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setData(result);
      return result;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "The action could not be completed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || !data || busy) {
      setError("Select a file to analyze.");
      return;
    }
    form.set("actor_id", actorId);
    form.set("expected_version", String(data.version));
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/building-updates", { method: "POST", body: form });
      const result = await response.json() as BuildingUpdateProjection & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setData(result);
      router.push(`/building-updates/${result.updateRef}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The source file could not be analyzed.");
    } finally {
      setBusy(false);
    }
  }

  async function startNewUpload() {
    if (!data?.canStartNewUpload || busy) return;
    setBusy(true);
    setError(null);
    try {
      await mutateDemo("reset");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  function selectUpload(event: ChangeEvent<HTMLInputElement>) {
    setUploadFilename(event.target.files?.[0]?.name ?? null);
  }

  async function decide(action: "confirm" | "publish") {
    const result = await mutate({ action });
    if (result) setNotice(action === "confirm" ? "Data Steward review is complete. Senior approval is next." : "Senior approval is complete. The current information has been updated.");
  }

  async function reviewDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.documentAsset || !reviewSummary.trim()) {
      setError("Enter the Data Steward review summary.");
      return;
    }
    const result = await mutate({
      action: "review_document",
      document_id: data.documentAsset.id,
      reviewed_summary: reviewSummary.trim(),
    });
    if (result) {
      setNotice(data.documentAsset.review_policy === "review_only"
        ? "Internal review is complete. This document is not published as an external reference."
        : "Data Steward review is complete. Senior publication is next.");
    }
  }

  async function publishDocument() {
    if (!data?.documentAsset) return;
    const result = await mutate({ action: "publish_document", document_id: data.documentAsset.id });
    if (result) setNotice("Senior review is complete and the approved reference is published separately from official leasing terms.");
  }

  if (error && !data) return <><UpdateNav current={view === "new" ? "new" : view === "history" ? "history" : "list"} /><PageHeader title="Building Data Intake" /><Notice tone="error">{error}</Notice></>;
  if (!data) return <Loading title="Building Data Intake" />;

  if (view === "new") {
    const canRegister = data.allowedActions.includes("register");
    const selectedBuilding = data.availableBuildings.find((building) => building.id === selectedBuildingId)
      ?? data.availableBuildings.find((building) => building.name === data.buildingName)
      ?? data.availableBuildings[0];
    const selectedType = data.documentTypes.find((type) => type.value === selectedDocumentType) ?? data.documentTypes[0];
    return <><UpdateNav current="new" /><PageHeader title="Upload Source" />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <section aria-label="Register building source">
        <form className={styles.uploadForm} onSubmit={(event) => void register(event)}>
          <label><span>Building</span><select name="building_id" value={selectedBuilding?.id ?? ""} onChange={(event) => setSelectedBuildingId(event.target.value)} disabled={!canRegister || busy}>{data.availableBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select><input name="building_name" type="hidden" value={selectedBuilding?.name ?? data.buildingName} /></label>
          <label><span>Source type</span><select name="document_type" value={selectedType?.value ?? data.documentType} onChange={(event) => { setSelectedDocumentType(event.target.value as DocumentType); setUploadFilename(null); }} disabled={!canRegister || busy}>{data.documentTypes.map((type) => <option key={type.value} value={type.value}>{documentTypeDisplayLabel(type.value)}</option>)}</select></label>
          <label className={styles.filePicker}><span>File</span><span className={styles.filePickerControl}><input key={selectedType?.value} accept={uploadAcceptForDocumentType(data.documentTypes, selectedType?.value ?? data.documentType)} aria-label="Choose file" name="file" onChange={selectUpload} required type="file" disabled={!canRegister || busy} /><span className={styles.filePickerButton}>Choose File</span><span className={styles.fileName}>{uploadFilename ?? "No file selected"}</span></span></label>
          <button className="lf-admin-button" type="submit" disabled={!canRegister || busy}>{busy ? "Analyzing document…" : "Upload Source"}</button>
        </form>
        <a className={styles.sampleDownload} download href="/api/demo/sample-source">Download Synthetic Sample</a>
        {!canRegister && data.canStartNewUpload ? <div className="lf-admin-permission"><p>Starting a new source test clears the current demo progress and returns to the first step.</p><button className="lf-admin-button lf-admin-button--secondary" disabled={busy} onClick={() => void startNewUpload()} type="button">{busy ? "Preparing…" : "Start New Source Test"}</button></div> : null}
        {!canRegister && !data.canStartNewUpload ? <p className="lf-admin-permission">This role cannot upload sources. Review active changes from In Progress.</p> : null}
      </section>
    </>;
  }

  if (view === "history") {
    return <><UpdateNav current="history" /><PageHeader title="Change History" />
      <section aria-labelledby="history-heading"><h2 id="history-heading">Building Change History</h2><div className="lf-admin-registry"><table><thead><tr><th scope="col">Building</th><th scope="col">Changed field</th><th scope="col">Value</th><th scope="col">Updated</th></tr></thead><tbody>{data.history.map((item, index) => <tr key={`${item.buildingName}-${item.label}-${item.updatedAt}-${index}`}><td>{item.buildingName}</td><td>{item.label}</td><td>{item.value}</td><td><time dateTime={item.updatedAt}>{dateLabel(item.updatedAt)}</time></td></tr>)}</tbody></table><ul className="lf-admin-registry-mobile lf-admin-history-mobile">{data.history.map((item, index) => <li key={`${item.buildingName}-${item.label}-${item.updatedAt}-mobile-${index}`}><h3>{item.buildingName}</h3><dl><div><dt>Changed field</dt><dd>{item.label}</dd></div><div><dt>Value</dt><dd>{item.value}</dd></div><div><dt>Updated</dt><dd><time dateTime={item.updatedAt}>{dateLabel(item.updatedAt)}</time></dd></div></dl></li>)}</ul></div></section>
    </>;
  }

  if (view === "list") {
    return <><UpdateNav current="list" /><PageHeader title="Building Data Intake" />
      <section aria-labelledby="update-list-heading"><div className="lf-admin-section-heading"><h2 id="update-list-heading">In Progress</h2><span>1 item</span></div><ul className="lf-admin-queue"><li><Link href={`/building-updates/${data.updateRef}`}><div><h3>{data.buildingName}</h3><p>{data.selectedFile.label} · {dateLabel(data.effectiveDate)}</p></div><dl><div><dt>Current step</dt><dd>{stepLabels[data.step]}</dd></div><div><dt>Source</dt><dd>{data.sourceOrganization}</dd></div><div><dt>Next</dt><dd>{data.step === "최신정보 반영" ? "Review change history" : "Review content"}</dd></div></dl></Link></li></ul></section>
      <section className="lf-admin-readonly" aria-labelledby="update-rule-heading"><h2 id="update-rule-heading">Publication Rule</h2><p>Uploading or reviewing a source does not change current information. Only content with final approval becomes available to the team.</p></section>
    </>;
  }

  if (updateRef !== data.updateRef) return <><PageHeader title="Building Data Intake" /><Notice tone="error">Select the active building update again from the list.</Notice></>;
  if (data.documentAsset) {
    const asset = data.documentAsset;
    const candidate = boundedReviewedCandidate(data.analysis?.status === "candidate_ready" ? data.analysis.reviewed_candidate : undefined);
    const canReviewDocument = data.allowedActions.includes("review_document") && asset.review_policy !== "manual_review";
    const canPublishDocument = data.allowedActions.includes("publish_document") && asset.review_policy === "publishable_reference";
    const terminalGuidance = documentTerminalGuidance(asset);
    return <><UpdateNav current="list" /><PageHeader title={data.buildingName} />
      <DocumentProgress asset={asset} />
      <Notice>Automatically extracted content is a review draft, not official building information.</Notice>
      {notice ? <Notice tone="success">{notice}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}
      <div className="lf-admin-review-grid" aria-busy={busy}>
        <div>
          <section className="lf-admin-surface" aria-labelledby="source-heading"><h2 id="source-heading">Uploaded Source</h2><dl className="lf-admin-ledger"><div><dt>File</dt><dd>{data.uploadedFile?.original_filename ?? data.selectedFile.label}</dd></div><div><dt>Source type</dt><dd>{documentTypeDisplayLabel(data.documentType)}</dd></div><div><dt>Building</dt><dd>{data.buildingName}</dd></div><div><dt>Status</dt><dd>{documentStatusLabel(asset.status)}</dd></div>{data.uploadedFile ? <div><dt>File size</dt><dd>{fileSizeLabel(data.uploadedFile.byte_size)}</dd></div> : null}</dl></section>
          <section className="lf-admin-surface" aria-labelledby="document-candidate-heading"><div className={styles.candidateHeading}><div><span>Not official building information</span><h2 id="document-candidate-heading">Review Draft</h2></div></div>{asset.reviewed_summary ? <div className={styles.reviewedSummary}><h3>Data Steward summary</h3><p>{asset.reviewed_summary}</p></div> : candidate ? <><p className={styles.candidateSummary}>{candidate.summary}</p>{candidate.facts.length ? <dl className={styles.candidateFacts}>{candidate.facts.map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : null}</> : <p className={styles.candidateSummary}>Automated review was unavailable. Review the original file manually.</p>}</section>
        </div>
        <aside className="lf-admin-decision" aria-labelledby="decision-heading"><h2 id="decision-heading">Next Review</h2><p>Current status: {documentStatusLabel(asset.status)}</p>
          {canReviewDocument ? <form className={styles.reviewForm} onSubmit={(event) => void reviewDocument(event)}><label htmlFor="reviewed-summary">Data Steward review summary</label><textarea id="reviewed-summary" maxLength={500} onChange={(event) => setReviewSummary(event.target.value)} required rows={7} value={reviewSummary} /><p>Edit the extracted summary before confirmation. This step alone does not change official building information.</p><button className="lf-admin-button" disabled={busy || !reviewSummary.trim()} type="submit">{busy ? "Reviewing…" : "Complete Review"}</button></form> : null}
          {canPublishDocument ? <><p>Publish the reviewed summary as an approved reference, kept separate from official leasing terms.</p><button className="lf-admin-button" disabled={busy} onClick={() => void publishDocument()} type="button">{busy ? "Publishing…" : "Publish Approved Reference"}</button></> : null}
          {!canReviewDocument && !canPublishDocument ? <p className="lf-admin-handoff">{terminalGuidance}</p> : null}
        </aside>
      </div>
    </>;
  }
  const canConfirm = data.allowedActions.includes("confirm");
  const canPublish = data.allowedActions.includes("publish");
  return <><UpdateNav current="list" /><PageHeader title={data.buildingName} />
    <Progress current={data.step} />
    {notice ? <Notice tone="success">{notice}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}
    <div className="lf-admin-review-grid" aria-busy={busy}>
      <div>
        <section className="lf-admin-surface" aria-labelledby="source-heading"><h2 id="source-heading">Uploaded Source</h2><dl className="lf-admin-ledger"><div><dt>File</dt><dd>{data.uploadedFile?.original_filename ?? data.selectedFile.label}</dd></div><div><dt>Source type</dt><dd>{documentTypeDisplayLabel(data.documentType)}</dd></div><div><dt>Building</dt><dd>{data.buildingName}</dd></div><div><dt>Effective date</dt><dd>{dateLabel(data.effectiveDate)}</dd></div>{data.uploadedFile ? <div><dt>File size</dt><dd>{fileSizeLabel(data.uploadedFile.byte_size)}</dd></div> : null}{data.analysis?.status === "candidate_ready" ? <div><dt>Changes to review</dt><dd>{data.analysis.candidate_count}</dd></div> : null}</dl></section>
        <section className="lf-admin-surface" aria-labelledby="changes-heading"><h2 id="changes-heading">Review Changes</h2>{data.changes.length ? <ul className="lf-admin-comparison">{data.changes.map((change) => <li key={change.label}><h3>{change.label}</h3><dl><div><dt>Current</dt><dd>{change.before}</dd></div><div><dt>Proposed</dt><dd>{change.after}</dd></div></dl></li>)}</ul> : <p>Detected changes will appear here after upload.</p>}</section>
      </div>
      <aside className="lf-admin-decision" aria-labelledby="decision-heading"><h2 id="decision-heading">Next Review</h2><p>Current step: {stepLabels[data.step]}</p>
        {canConfirm ? <button className="lf-admin-button" disabled={busy} onClick={() => void decide("confirm")} type="button">{busy ? "Reviewing…" : "Complete Data Steward Review"}</button> : null}
        {canPublish ? <button className="lf-admin-button" disabled={busy} onClick={() => void decide("publish")} type="button">{busy ? "Publishing…" : "Approve and Publish Current Information"}</button> : null}
        {!canConfirm && !canPublish ? <p className="lf-admin-handoff">{data.step === "최신정보 반영" ? "Current information has been published." : "Waiting for the assigned role to complete this review."}</p> : null}
      </aside>
    </div>
  </>;
}
