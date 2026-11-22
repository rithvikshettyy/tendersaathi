"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { closesLabel, crore, inr, samplePdf, winCls } from "@/lib/tender";
import type { Analysis, FillPack, Intel, Readiness, Tender } from "@/lib/types";

const lvl = { green: "green", amber: "amber", red: "red" } as const;
const verdictCls = (v: string) => (v === "Well aligned" ? "green" : v === "Not aligned" ? "red" : "amber");
const riskCls = (r: string) => (r === "High" ? "red" : r === "Medium" ? "amber" : "green");

export default function TenderWorkspace() {
  const id = Number(useParams<{ id: string }>().id);
  const [t, setT] = useState<Tender | null>(null);

  useEffect(() => {
    api<Tender[]>("/tenders").then(all => setT(all.find(x => x.id === id) ?? null)).catch(() => setT(null));
  }, [id]);

  const [ready, setReady] = useState<Readiness | null>(null);
  const loadReady = useCallback(() => api<Readiness>(`/tenders/${id}/readiness`).then(setReady).catch(() => {}), [id]);
  useEffect(() => { loadReady(); }, [loadReady]);

  const reload = () => api<Tender[]>("/tenders").then(all => setT(all.find(x => x.id === id) ?? null)).catch(() => {});

  if (!t) return <p className="muted">Loading…</p>;
  return (
    <>
      <p><Link href="/tenders">← All tenders</Link></p>
      <h2>{t.title}</h2>
      <span className="pill">{t.source}</span><span className="pill">{t.category}</span>{t.demo && <span className="pill sample">Sample</span>}
      {t.found_via && <span className="pill muted">found via {t.found_via}</span>}
      {t.link.startsWith("http") && <a href={t.link} target="_blank" rel="noopener noreferrer">Official page ↗</a>}
      {samplePdf(t) && <a href={samplePdf(t)} target="_blank" rel="noopener noreferrer">Sample PDF ↗</a>}

      <WinCard t={t} onRead={setT} />
      <AnalysisCard t={t} onDone={() => { reload(); loadReady(); }} />
      <IntelCard t={t} onDone={i => { setT({ ...t, intel: i }); reload(); }} />
      {ready && <ReadinessCard id={id} r={ready} onChange={setReady} />}
      <FillCard id={id} />
    </>
  );
}

function WinCard({ t, onRead }: { t: Tender; onRead: (t: Tender) => void }) {
  const [msg, setMsg] = useState("");
  const f = t.facts || {};
  const w = t.win;
  async function reread() {
    setMsg("Reading the official page with You.com…");
    try { onRead(await api<Tender>(`/tenders/${t.id}/read`, { method: "POST" })); setMsg(""); }
    catch (e) { setMsg((e as Error).message); }
  }
  const readBy = { "you.com": "You.com Extract", direct: "direct download", snippet: "search summary only", upload: "your PDF upload", sample: "a sample GeM-format bid PDF (demo data)" }[t.reader ?? ""] || "";
  return (
    <div className="card">
      <div className="tender-head">
        <div>
          <h3>Win chance</h3>
          {closesLabel(t) && <p className={(f.days_left ?? 99) < 3 ? "amber" : ""} style={{ margin: 0 }}>{closesLabel(t)}</p>}
          {readBy && <p className="muted small" style={{ margin: 0 }}>Read from {readBy}{f.read_note ? ` (${f.read_note})` : ""}</p>}
        </div>
        {w ? (
          <div className={`win ${winCls(w.label)}`}><small>{w.label === "Closed" ? "" : "Win chance"}</small><b>{w.label}</b>{w.label !== "Closed" && <span>{w.score}/100</span>}</div>
        ) : <div className="win"><small>Not read yet</small></div>}
      </div>
      <div className="kv">
        {f.bid_no && <div><span>Bid / Tender ID</span>{f.bid_no}</div>}
        {(f.org || t.org) && <div><span>Buyer</span>{t.org || f.org}</div>}
        {f.value_cr != null && <div><span>Estimated value</span>{crore(f.value_cr)}</div>}
        {f.emd_rupees != null && <div><span>EMD</span>{inr(f.emd_rupees)}</div>}
        {f.pincode && <div><span>Pincode</span>{f.pincode}</div>}
        {f.matched_terms && <div><span>Matches</span>{f.matched_terms.join(", ")}</div>}
      </div>
      {w && <ul className="reasons">{w.reasons.map((r, k) => <li key={k} className={r.level}>{r.msg}</li>)}</ul>}
      {t.link.startsWith("http") && <button onClick={reread}>{w ? "Re-read official page" : "Read official page"}</button>}
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}

function AnalysisCard({ t, onDone }: { t: Tender; onDone: (a: Analysis) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  async function run() {
    const f = file.current?.files?.[0];
    if (!f && !t.demo) return;               // sample tenders need no file
    const form = new FormData(); if (f) form.append("file", f);
    setMsg("Reading…");
    try { onDone(await api<Analysis>(`/tenders/${t.id}/analyze`, { form })); setMsg(""); }
    catch (e) { setMsg((e as Error).message); }
  }
  const a = t.analysis;
  return (
    <div className="card">
      <h3>1. Eligibility check</h3>
      {!t.demo && <p className="muted small">Checked automatically from the official page. Have the full tender PDF? Upload it for a more exact check.</p>}
      <div className="row">
        {!t.demo && <input type="file" accept="application/pdf" ref={file} style={{ width: "auto" }} />}
        <button onClick={run}>{t.demo ? "Run sample analysis" : "Analyze PDF"}</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      {a ? (
        <>
          <h4 className={verdictCls(a.verdict)}>{a.verdict} · scope match {a.scope_match_pct}%</h4>
          <ul>{a.flags.map((f, i) => <li key={i} className={lvl[f.level]}>{f.msg}</li>)}</ul>
          <details><summary>Extracted terms</summary><pre>{JSON.stringify(a.terms, null, 2)}</pre></details>
        </>
      ) : <p className="muted">Not checked yet. Read the official page above, or upload the tender PDF.</p>}
    </div>
  );
}

function IntelCard({ t, onDone }: { t: Tender; onDone: (i: Intel) => void }) {
  const [msg, setMsg] = useState("");
  async function run() {
    setMsg("Searching public sources with SerpAPI and You.com…");
    try { onDone(await api<Intel>(`/tenders/${t.id}/intel`, { method: "POST" })); setMsg(""); }
    catch (e) { setMsg((e as Error).message); }
  }
  const i = t.intel;
  return (
    <div className="card">
      <h3>2. Buyer risk & competitors</h3>
      <button onClick={run}>Run risk analysis</button>
      {msg && <p className="muted">{msg}</p>}
      {i && (
        <>
          <h4>Risk: <span className={riskCls(i.risk_level)}>{i.risk_level}</span> (score {i.risk_score}) · {i.subject}</h4>
          {i.flags.length > 0 && <><b>Signals</b><ul>{i.flags.map((f, k) => (
            <li key={k}>{f.signal}: {f.text} {f.source.startsWith("http") && <a href={f.source} target="_blank" rel="noopener noreferrer">src</a>}</li>))}</ul></>}
          <p><b>Likely competitors</b> {i.competitors.length
            ? i.competitors.map(c => <span className="pill" key={c.name}>{c.name} ×{c.mentions}</span>)
            : <span className="muted">none found</span>}</p>
          {i.past_offers.length > 0 && <><b>Past offer / value mentions</b><ul>{i.past_offers.map((o, k) => (
            <li key={k}>{o.amount} — {o.context}</li>))}</ul></>}
          <p className="muted">{i.note}</p>
        </>
      )}
    </div>
  );
}

function ReadinessCard({ id, r, onChange }: { id: number; r: Readiness; onChange: (r: Readiness) => void }) {
  async function toggle(key: string, v: boolean) {
    onChange(await api<Readiness>(`/tenders/${id}/readiness`, { method: "PUT", body: { items: { ...r.checked, [key]: v } } }));
  }
  const cls = r.score >= 80 ? "green" : r.score >= 50 ? "amber" : "red";
  return (
    <div className="card">
      <h3>3. Bid readiness</h3>
      <div className={`score ${cls}`}>{r.score}/100 <small>{r.grade}</small></div>
      <p className="muted">
        Documents {r.breakdown.documents}/50 · Profile {r.breakdown.profile}/20 · Alignment {r.breakdown.alignment}/20 · Timing {r.breakdown.timing}/10
        {r.days_left != null && ` · ${r.days_left} days left`}
      </p>
      {r.items.map(i => (
        <label className="chk" key={i.key}>
          <input type="checkbox" checked={!!r.checked[i.key]} onChange={e => toggle(i.key, e.target.checked)} /> {i.label}
        </label>
      ))}
    </div>
  );
}

function FillCard({ id }: { id: number }) {
  const [p, setP] = useState<FillPack | null>(null);
  return (
    <div className="card">
      <h3>4. Assisted form filling</h3>
      <button onClick={async () => setP(await api<FillPack>(`/tenders/${id}/fillpack`))}>Generate fill pack</button>
      {p && (
        <>
          <table><tbody>{Object.entries(p.fields).map(([k, v]) => (
            <tr key={k}><td className="muted">{k}</td><td>{String(v)}</td></tr>))}</tbody></table>
          <ol>{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </>
      )}
    </div>
  );
}
