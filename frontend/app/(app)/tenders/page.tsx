"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Tender } from "@/lib/types";

const verdictCls = (v?: string) => (v === "Well aligned" ? "green" : v === "Not aligned" ? "red" : "amber");

export default function Tenders() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [kind, setKind] = useState("");
  const [cat, setCat] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Tender[]>("/tenders").then(setTenders), []);
  useEffect(() => { load(); }, [load]);

  async function search() {
    setBusy(true); setMsg("Searching government and private portals across India…");
    try {
      const r = await api<{ found: number; new: number }>("/tenders/search", { method: "POST" });
      setMsg(`Found ${r.found} results, ${r.new} new.`);
      await load();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function addManual() {
    const title = prompt("Tender title");
    if (!title) return;
    await api("/tenders", { body: { title, link: prompt("Tender link (optional)") || "" } });
    load();
  }

  const cats = [...new Set(tenders.map(t => t.category))];
  const list = tenders.filter(t => (!kind || t.kind === kind) && (!cat || t.category === cat));

  return (
    <>
      <div className="bar">
        <h2>Tenders</h2>
        <div className="row">
          <button className="primary" onClick={search} disabled={busy}>Find tenders (SerpAPI)</button>
          <button onClick={addManual}>+ Add manually</button>
        </div>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="filters">
        <select value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">All sources</option><option value="government">Government</option>
          <option value="private/aggregator">Private / aggregator</option><option value="manual">Manual</option>
        </select>
        <select value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">All categories</option>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      {list.map(t => (
        <div className="card tender" key={t.id}>
          <h3>{t.title}</h3>
          <span className="pill">{t.kind}</span><span className="pill">{t.category}</span>
          {t.org && <span className="pill">{t.org}</span>}
          {t.analysis && <span className={`pill ${verdictCls(t.analysis.verdict)}`}>{t.analysis.verdict}</span>}
          {t.intel && <span className="pill">Risk: {t.intel.risk_level}</span>}
          <p className="muted">{t.snippet}</p>
          <div className="row">
            <Link href={`/tenders/${t.id}`}><button className="primary">Open workspace</button></Link>
            {t.link.startsWith("http") && <a href={t.link} target="_blank" rel="noopener noreferrer"><button>Source ↗</button></a>}
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="muted">No tenders yet. Click “Find tenders”.</p>}
    </>
  );
}
