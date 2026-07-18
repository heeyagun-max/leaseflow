"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemoState } from "@leaseflow/demo-data";

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

type Notice = { message: string; severity: "info" | "success" | "error" };

export default function Page() {
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [actorId, setActorId] = useState("usr-junior");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const reload = useCallback(async () => {
    const response = await fetch("/api/demo/workflow", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load the demo workflow.");
    setWorkflow(await response.json() as WorkflowResponse);
  }, []);

  useEffect(() => {
    void reload().catch((error: Error) => setNotice({ message: error.message, severity: "error" }));
  }, [reload]);

  async function mutate(action: "extract" | "confirm" | "publish" | "reset") {
    if (!workflow) return;
    setBusy(true);
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
      setNotice({
        severity: "success",
        message: action === "publish"
          ? "Publication complete. Mobile now exposes 200 py and plan v2; plan v1 is blocked."
          : `${action[0]!.toUpperCase()}${action.slice(1)} complete.`,
      });
    } catch (error) {
      setNotice({
        severity: "error",
        message: error instanceof Error ? error.message : "Unknown workflow error.",
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!workflow) return <main><div className="card">Loading governed demo state…</div></main>;
  const { state, source, users } = workflow;
  const actor = users.find((user) => user.id === actorId) ?? users[0]!;

  return (
    <main>
      <header>
        <div><div className="brand">LeaseFlow Data Admin</div><div className="muted">Synthetic demo · revision {state.revision}</div></div>
        <label className="role-picker">Demo scenario actor · not authentication
          <select value={actorId} onChange={(event) => setActorId(event.target.value)} disabled={busy}>
            {users.map((user) => <option key={user.id} value={user.id}>{user.display_name} · {user.role}</option>)}
          </select>
        </label>
      </header>
      {notice && <div className={`notice ${notice.severity}`}>{notice.message}</div>}
      <section className="grid">
        <div className="card">
          <div className="kicker">Source-to-publish vertical slice</div>
          <h1>{source.buildingName}<br/>{source.title}</h1>
          <p>Extraction creates candidates only. Data Steward confirmation and Senior Reviewer publication are separate server-authorized mutations.</p>
          <p className="hint">Source {source.id} · effective {source.effectiveDate}. Candidate values remain hidden until extraction runs.</p>
          {state.candidates.length === 0
            ? <div className="empty-candidates">No extracted values yet.</div>
            : <table>
              <thead><tr><th>Field</th><th>Previous</th><th>Candidate</th><th>Exact target</th></tr></thead>
              <tbody>{state.candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>{candidate.field}</td>
                  <td className="old">{String(candidate.previous_value)}</td>
                  <td className="new">{String(candidate.proposed_value)}</td>
                  <td><span className="mono">{candidate.candidate_version_id}</span><br/><span className="muted">{candidate.source_pointer}</span></td>
                </tr>
              ))}</tbody>
            </table>}
          <div className="actions">
            <button className="primary" disabled={busy || state.stage !== "source_uploaded"} onClick={() => void mutate("extract")}>1. Extract four candidates</button>
            <button className="secondary" disabled={busy || state.stage !== "extracted_candidate"} onClick={() => void mutate("confirm")}>2. Confirm as current actor</button>
            <button className="secondary" disabled={busy || state.stage !== "junior_confirmed"} onClick={() => void mutate("publish")}>3. Publish as current actor</button>
            <button className="ghost" disabled={busy} onClick={() => void mutate("reset")}>Reset demo data</button>
          </div>
          <p className="hint">Current actor: <strong>{actor.display_name}</strong>. Try publishing as Data Steward to see the server reject it without changing revision or records.</p>
          <p className="hint">Persistence: {workflow.storage}</p>
        </div>
        <aside className="card">
          <div className="state-row"><div><div className="kicker">Governance state</div><h2>{state.stage.replaceAll("_", " ")}</h2></div><span className="pill">{state.candidates.length} candidates</span></div>
          <div className="timeline">
            {[
              ["source_uploaded", "Source uploaded", "Synthetic July source selected."],
              ["extracted_candidate", "Extraction candidates", "Exactly four source-backed changes."],
              ["junior_confirmed", "Data Steward confirmed", "Candidates ready for senior review."],
              ["published", "Senior publication", "v1 retained as superseded; v2 is current."],
            ].map(([key, title, copy]) => <div className={`step ${state.stage === key ? "active" : ""}`} key={key}><span className="dot"/><div><strong>{title}</strong><p>{copy}</p></div></div>)}
          </div>
          <h3>Audit trail</h3>
          {state.audit.length === 0 ? <p>No mutations yet.</p> : <ol className="audit">{state.audit.map((event) => <li key={event.id}><strong>{event.event_type}</strong><span>{event.actor_id} · {event.occurred_at}</span></li>)}</ol>}
          <div className="actions"><a className="button primary" href="/mobile-preview">Open governed mobile preview</a></div>
        </aside>
      </section>
      <section className="card history-card">
        <div className="kicker">Governed version history</div>
        <h2>Operational records and files</h2>
        <p>Candidate versions appear only after extraction. Published history remains visible after supersession.</p>
        <h3>Record versions</h3>
        <div className="table-scroll"><table>
          <thead><tr><th>ID</th><th>Field</th><th>Version</th><th>Status</th><th>Effective</th><th>Superseded</th></tr></thead>
          <tbody>{state.records.map((record) => <tr key={record.id}>
            <td className="mono">{record.id}</td><td>{record.field}</td><td>v{record.version_no}</td><td>{record.status}</td>
            <td>{record.valid_from} → {record.valid_to ?? "current"}</td><td>{record.superseded ? "yes" : "no"}</td>
          </tr>)}</tbody>
        </table></div>
        <h3>File versions</h3>
        <div className="table-scroll"><table>
          <thead><tr><th>ID</th><th>File</th><th>Version</th><th>Status</th><th>Effective</th><th>Superseded</th></tr></thead>
          <tbody>{state.files.map((file) => <tr key={file.id}>
            <td className="mono">{file.id}</td><td>{file.filename}</td><td>v{file.version_no}</td><td>{file.status}</td>
            <td>{file.valid_from} → {file.valid_to ?? "current"}</td><td>{file.superseded ? "yes" : "no"}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
    </main>
  );
}
