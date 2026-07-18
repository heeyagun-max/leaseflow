import { demoSourceUpdate } from "@leaseflow/demo-data";

export default function Page() {
  return (
    <main>
      <header><div className="brand">LeaseFlow Data Admin</div><span className="pill">DEMO · Data Steward</span></header>
      <section className="grid">
        <div className="card">
          <div className="kicker">Source-to-publish vertical slice</div>
          <h1>{demoSourceUpdate.buildingName}<br/>July leasing update</h1>
          <p>GPT-5.6 extracts candidate changes. A junior confirms them, and a senior reviewer publishes the official operational versions.</p>
          <table>
            <thead><tr><th>Field</th><th>Current</th><th>Candidate</th><th>Source</th></tr></thead>
            <tbody>{demoSourceUpdate.changes.map((change) => (
              <tr key={change.field}><td>{change.field}</td><td className="old">{String(change.previous)}</td><td className="new">{String(change.proposed)}</td><td>{change.source}</td></tr>
            ))}</tbody>
          </table>
          <div className="actions"><button className="primary">Run GPT-5.6 extraction</button><button className="secondary">Confirm as junior</button><button className="secondary">Switch to senior</button></div>
        </div>
        <aside className="card">
          <h2>Governance state</h2>
          <div className="timeline">
            <div className="step"><span className="dot"/><div><strong>Source uploaded</strong><p>Safe synthetic July update selected.</p></div></div>
            <div className="step"><span className="dot"/><div><strong>Extraction candidates</strong><p>Four changes require confirmation.</p></div></div>
            <div className="step"><span className="dot"/><div><strong>Senior publication</strong><p>Pending. Mobile app still sees the prior published version until approval.</p></div></div>
          </div>
          <div className="actions"><a className="button primary" href="/mobile-preview">Open mobile preview</a></div>
        </aside>
      </section>
    </main>
  );
}
