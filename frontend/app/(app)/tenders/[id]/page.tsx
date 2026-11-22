"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Analysis, FillPack, Intel, Readiness, Tender } from "@/lib/types";

const lvl = { green: "green", amber: "amber", red: "red" } as const;
const verdictCls = (v: string) => (v === "Well aligned" ? "green" : v === "Not aligned" ? "red" : "amber");
const riskCls = (r: string) => (r === "High" ? "red" : r === "Medium" ? "amber" : "green");

export default function TenderWorkspace() {
  const id = Number(useParams<{ id: string }>().id);
  const [t, setT] = useState<Tender | null>(null);

  useEffect(() => {
    api<Tender[]>("/tenders").then(all => setT(all.find(x => x.id === id) ?? null));
  }, [id]);

  const [ready, setReady] = useState<Readiness | null>(null);
  const loadReady = useCallback(() => api<Readiness>(`/tenders/${id}/readiness`).then(setReady), [id]);
  useEffect(() => { loadReady(); }, [loadReady]);

  if (!t) return <p className="muted">Loading…</p>;
  return (
    <>
      <p><Link href="/tenders">← All tenders</Link></p>
      <h2>{t.title}</h2>
      <span className="pill">{t.kind}</span><span className="pill">{t.category}</span>
      {t.link.startsWith("http") && <a href={t.link} target="_blank" rel="noopener noreferrer">Open source ↗</a>}

      <AnalysisCard t={t} onDone={a => { setT({ ...t, analysis: a }); loadReady(); }} />
      <IntelCard t={t} onDone={i => setT({ ...t, intel: i })} />
      {ready && <ReadinessCard id={id} r={ready} onChange={setReady} />}
      <FillCard id={id} />
    </>
  );
}

function AnalysisCard({ t, onDone }: { t: Tender; onDone: (a: Analysis) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  async function run() {
    const f = file.current?.files?.[0];
    if (!f) return;
    const form = new FormData(); form.append("file", f);
    setMsg("Reading…");
    try { onDone(await api<Analysis>(`/tenders/${t.id}/analyze`, { form })); setMsg(""); }
    catch (e) { setMsg((e as Error).message); }
  }
  const a = t.analysis;
  return (
    <div className="card">
      <h3>1. Tender PDF analysis</h3>
      <div className="row"><input type="file" accept="application/pdf" ref={file} style={{ width: "auto" }} /><button onClick={run}>Analyze PDF</button></div>
      {msg && <p className="muted">{msg}</p>}
      {a ? (
        <>
          <h4 className={verdictCls(a.verdict)}>{a.verdict} · scope match {a.scope_match_pct}%</h4>
          <ul>{a.flags.map((f, i) => <li key={i} className={lvl[f.level]}>{f.msg}</li>)}</ul>
          <details><summary>Extracted terms</summary><pre>{JSON.stringify(a.terms, null, 2)}</pre></details>
        </>
      ) : <p className="muted">Upload the tender PDF to check eligibility against your profile.</p>}
    </div>
  );
}

function IntelCard({ t, onDone }: { t: Tender; onDone: (i: Intel) => void }) {
  const [msg, setMsg] = useState("");
  async function run() {
    setMsg("Searching public sources…");
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
            <li key={k}>{f.signal}: {f.text} <a href={f.source} target="_blank" rel="noopener noreferrer">src</a></li>))}</ul></>}
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
