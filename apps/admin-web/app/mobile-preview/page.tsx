"use client";

import { useEffect, useState } from "react";
import { type MobilePublishedSnapshot } from "@leaseflow/demo-data";

interface PublicRequest { id: string; source: "call" | "email"; status: "candidate" | "confirmed"; summary: { building_id: string | null; floor: string | null; requested_fields: string[]; requested_files: string[]; recipient: { name: string | null; organization: string | null }; deadline: string | null; ambiguities: Array<{ field: string; reason: string }> } }
interface PublicPackage { id: string; building_id: string; floor: string; status: "draft" | "edit_pending" | "approved" | "sent" | "stale"; subject: string; body: string; facts: Array<{ label: string; value: number; unit: string; version_id: string; source_pointer: string }>; files: Array<{ filename: string; version_id: string; source_pointer: string }>; recipients: { to: string[]; cc: string[]; configuration_id: string }; unresolved: string[]; protected_material_status: "verified"; edit_candidate: { subject: string; body: string } | null }
interface WorkflowView {
  revision: number; publication_stage: string; requests: PublicRequest[]; packages: PublicPackage[];
  activities: Array<{ event_type: string; summary: string }>; audit: Array<{ event_label: string; occurred_at: string }>;
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
      if (!publishedResponse.ok || !workflowResponse.ok) throw new Error("Publish Stage 2 first, then reload the mobile workflow.");
      setSnapshot(await publishedResponse.json() as MobilePublishedSnapshot);
      setWorkflow(await workflowResponse.json() as WorkflowView);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load workflow."); }
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
      if (!response.ok) throw new Error("error" in body ? body.error : "Workflow action failed.");
      setWorkflow(body as WorkflowView); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Workflow action failed."); }
    finally { setBusy(false); }
  }

  useEffect(() => { void reload(); }, []);
  const request = workflow?.requests.at(-1);
  const pkg = workflow?.packages.at(-1);

  return <main className="lf-legacy-page">
    <header><div className="brand">LeaseFlow Mobile Operations Preview</div><span className="pill">DEMO · LM Manager · SANDBOX ONLY</span></header>
    {error && <div className="notice error">{error}</div>}
    <div className="grid">
      <section className="card">
        <div className="kicker">Published-only material</div><h1>Cobalt 5F package</h1>
        {snapshot && <>
          <div className="snapshot-grid"><Metric label="Marketed area" value={`${snapshot.marketed_area_py} py`}/><Metric label="Rent-free" value={`${snapshot.rent_free_months} months`}/><Metric label="Parking" value={`${snapshot.supported_parking_spaces} spaces`}/></div>
          <div className="plan"><strong>Current plan</strong><span>{snapshot.floor_plan.filename} · {snapshot.floor_plan.version_id}</span></div>
          <div className="warning"><strong>Stale plan blocked</strong><span>{snapshot.blocked_floor_plans.join(", ") || "Publish v2 to demonstrate"}</span></div>
        </>}
        <p className="hint">Official values and version references are read-only throughout this communications flow.</p>
      </section>
      <section className="card">
        <div className="kicker">Request → confirmation → approval → activity</div>
        <h2>{pkg ? `Package: ${pkg.status}` : request ? `Request: ${request.status}` : "Import a synthetic request"}</h2>
        {!request && <div className="actions"><button className="primary" disabled={busy || !workflow} onClick={() => void act({ action: "import", source: "call" })}>Import call fixture</button><button className="secondary" disabled={busy || !workflow} onClick={() => void act({ action: "import", source: "email" })}>Import email fixture</button></div>}
        {request?.status === "candidate" && <><RequestSummary request={request}/><button className="primary" disabled={busy} onClick={() => void act({ action: "confirm", request_id: request.id })}>Confirm request</button></>}
        {request?.status === "confirmed" && !pkg && <button className="primary" disabled={busy} onClick={() => void act({ action: "draft", request_id: request.id })}>Draft from current published versions</button>}
        {pkg && <PackagePanel pkg={pkg} busy={busy} act={act}/>}
        <p className="hint">Revision {workflow?.revision ?? "—"} · {workflow?.audit.length ?? 0} audit events · {workflow?.activities.length ?? 0} outbound activities</p>
      </section>
    </div>
    <div className="actions"><button className="ghost" onClick={() => void reload()}>Reload</button><a className="button secondary" href="/">Back to Admin</a></div>
  </main>;
}

function PackagePanel({ pkg, busy, act }: { pkg: PublicPackage; busy: boolean; act: (action: Record<string, unknown>) => Promise<void> }) {
  return <div>
    <div className="notice success">To: {pkg.recipients.to.join(", ")} · Cc: {pkg.recipients.cc.join(", ") || "none"} · config {pkg.recipients.configuration_id}</div>
    <div className="notice info">Unresolved: {pkg.unresolved.length} · protected material: {pkg.protected_material_status}</div>
    <p className="mono"><strong>{pkg.subject}</strong>{"\n"}{pkg.body}</p>
    <ul>{pkg.facts.map((fact) => <li key={fact.version_id}>{fact.label}: {fact.value} {fact.unit} <span className="muted">({fact.version_id} · {fact.source_pointer})</span></li>)}</ul>
    <ul>{pkg.files.map((file) => <li key={file.version_id}>Attachment: {file.filename} <span className="muted">({file.version_id} · {file.source_pointer})</span></li>)}</ul>
    {pkg.status === "edit_pending" && pkg.edit_candidate && <div className="grid">
      <div className="notice error"><strong>Original</strong><p className="mono">{pkg.subject}{"\n"}{pkg.body}</p></div>
      <div className="notice info"><strong>Proposed</strong><p className="mono">{pkg.edit_candidate.subject}{"\n"}{pkg.edit_candidate.body}</p></div>
    </div>}
    <div className="actions">
      {pkg.status === "draft" && <><button className="secondary" disabled={busy} onClick={() => void act({ action: "edit", package_id: pkg.id, instruction: "Make concise and courteous" })}>Propose subject/body edit</button><button className="primary" disabled={busy} onClick={() => void act({ action: "approve", package_id: pkg.id })}>Approve as LM Manager</button></>}
      {pkg.status === "edit_pending" && <><button className="primary" disabled={busy} onClick={() => void act({ action: "decide", package_id: pkg.id, decision: "accept" })}>Accept edit</button><button className="ghost" disabled={busy} onClick={() => void act({ action: "decide", package_id: pkg.id, decision: "reject" })}>Reject edit</button></>}
      {pkg.status === "approved" && <button className="primary" disabled={busy} onClick={() => void act({ action: "send", package_id: pkg.id, idempotency_key: `judge-sandbox-${pkg.id}` })}>Send sandbox package</button>}
    </div>
    {pkg.status === "sent" && <div className="notice success">Sandbox sent exactly once. Outbound activity recorded; no production integration was called.</div>}
  </div>;
}

function RequestSummary({ request }: { request: PublicRequest }) {
  const summary = request.summary;
  return <div className="notice info">
    <strong>GPT output is a candidate. Confirm every extracted field.</strong>
    <ul>
      <li>Building: {summary.building_id ?? "unresolved"}</li>
      <li>Floor: {summary.floor ?? "unresolved"}</li>
      <li>Requested fields: {summary.requested_fields.join(", ") || "none"}</li>
      <li>Requested files: {summary.requested_files.join(", ") || "none"}</li>
      <li>Recipient: {summary.recipient.name ?? "unresolved"} · {summary.recipient.organization ?? "unresolved"}</li>
      <li>Deadline: {summary.deadline ?? "unresolved"}</li>
      <li>Ambiguities: {summary.ambiguities.length ? summary.ambiguities.map((item) => `${item.field}: ${item.reason}`).join("; ") : "none"}</li>
    </ul>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
