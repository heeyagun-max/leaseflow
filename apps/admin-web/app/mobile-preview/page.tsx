"use client";

import { useEffect, useState } from "react";
import { demoRequest, type MobilePublishedSnapshot } from "@leaseflow/demo-data";

export default function MobilePreview() {
  const [snapshot, setSnapshot] = useState<MobilePublishedSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const response = await fetch("/api/mobile/published", { cache: "no-store" });
      if (!response.ok) throw new Error("Published snapshot is unavailable.");
      setSnapshot(await response.json() as MobilePublishedSnapshot);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load snapshot.");
    }
  }

  useEffect(() => { void reload(); }, []);

  return <main><header><div className="brand">LeaseFlow Mobile Preview</div><span className="pill">DEMO · LM Manager</span></header><div className="card mobile-card">
    <div className="kicker">Authorized published snapshot</div><h1>Current 5F package</h1><p>{demoRequest.text}</p>
    {error && <div className="notice error">{error}</div>}
    {snapshot && <>
      <div className="snapshot-grid"><Metric label="Marketed area" value={`${snapshot.marketed_area_py} py`}/><Metric label="Rent-free" value={`${snapshot.rent_free_months} months`}/><Metric label="Parking support" value={`${snapshot.supported_parking_spaces} spaces`}/></div>
      <div className="plan"><strong>Current floor plan</strong><a href={snapshot.floor_plan.download_url} target="_blank">{snapshot.floor_plan.filename}</a></div>
      <div className="warning"><strong>Blocked stale plans</strong><span>{snapshot.blocked_floor_plans.length ? snapshot.blocked_floor_plans.join(", ") : "None before publication"}</span></div>
      <p className="hint">Workflow: {snapshot.publication_stage} · revision {snapshot.revision}</p>
    </>}
    <div className="actions"><button className="primary" onClick={() => void reload()}>Reload published data</button><a className="button secondary" href="/">Back to Admin</a></div>
  </div></main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
