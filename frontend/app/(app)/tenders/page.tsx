"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { closesLabel, crore, inr, isOpen, samplePdf, winCls } from "@/lib/tender";
import type { ReadResult, SearchResult, Tender } from "@/lib/types";

type View = "open" | "all" | "closed";

export default function Tenders() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [apis, setApis] = useState<{ serpapi: boolean; youcom: boolean } | null>(null);
  const [view, setView] = useState<View>("open");
  const [chance, setChance] = useState("");
  const [portal, setPortal] = useState("");
  const [msg, setMsg] = useState("");
  const [warn, setWarn] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => { setQ(new URLSearchParams(window.location.search).get("q") ?? ""); }, []);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(() => api<Tender[]>("/tenders").then(setTenders).catch(() => setTenders([])), []);
  useEffect(() => {
    load();
    api<{ serpapi: boolean; youcom: boolean }>("/status").then(setApis).catch(() => {});
  }, [load]);

  async function readAll(total: number) {
    let done = 0;
    setProgress({ done, total });
    for (;;) {
      const r = await api<ReadResult>("/tenders/read?limit=4", { method: "POST" });
      done += r.processed;
      setProgress({ done, total: Math.max(total, done + r.remaining) });
      await load();
      if (!r.remaining || !r.processed) break;
    }
    setProgress(null);
  }

  async function search() {
    setBusy(true); setWarn([]);
    setMsg("Searching official government portals with SerpAPI (Google) and You.com…");
    try {
      const r = await api<SearchResult>("/tenders/search", { method: "POST" });
      if (r.demo) {
        setMsg(`Live search isn't available, so I added ${r.new} sample tenders.`);
        await load();
        return;
      }
      setWarn(r.warnings || []);
      setMsg(`Found ${r.found} open tenders (GeM ${r.gem ?? 0}, SerpAPI ${r.serpapi}, You.com ${r.youcom}), ${r.new} new. Reading each one…`);
      await load();
      if (r.pending) await readAll(r.pending);
      setMsg(`Done. ${r.found} tenders checked against your profile.`);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); setProgress(null); }
  }

  async function readPending() {
    setBusy(true); setMsg("Reading unread tenders…");
    try { await readAll(tenders.filter(t => t.read_status === "pending").length); setMsg(""); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  async function loadSamples() {
    setBusy(true); setMsg("Loading sample GeM bid documents and scoring them against your profile…");
    try {
      const r = await api<{ loaded: number; new: number }>("/tenders/demo", { method: "POST" });
      setMsg(`Loaded ${r.loaded} sample GeM tenders (${r.new} new). Samples are synthetic demo data, not real bids.`);
      await load();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  async function addManual() {
    const title = prompt("Tender title");
    if (!title) return;
    await api("/tenders", { body: { title, link: prompt("Official tender link (optional)") || "" } });
    await load();
  }

  const needle = q.trim().toLowerCase();
  const pending = tenders.filter(t => t.read_status === "pending").length;
  const portals = [...new Set(tenders.map(t => t.source))].filter(Boolean);
  const list = tenders.filter(t =>
    (view === "all" || (view === "open" ? isOpen(t) : t.status === "closed")) &&
    (!needle || `${t.title} ${t.snippet} ${t.org} ${t.category}`.toLowerCase().includes(needle)) &&
    (!chance || t.win?.label === chance) && (!portal || t.source === portal));
  const openCount = tenders.filter(isOpen).length;
  const high = tenders.filter(t => isOpen(t) && t.win?.label === "High").length;

  return (
    <>
      <div className="bar">
        <div>
          <h2>Top tenders for you</h2>
          <p className="muted" style={{ margin: 0 }}>
            Open tenders from official government sites, ranked by your chance of winning.
          </p>
        </div>
        <div className="row">
          <button className="primary" onClick={search} disabled={busy}>Find matching tenders</button>
          {pending > 0 && !busy && <button onClick={readPending}>Read {pending} unread</button>}
          <button onClick={loadSamples} disabled={busy}>Load sample tenders</button>
          <button onClick={addManual} disabled={busy}>+ Add manually</button>
        </div>
      </div>

      {apis && (
        <p className="muted apis">
          <span className={`pill ${apis.serpapi ? "green" : "red"}`}>SerpAPI {apis.serpapi ? "connected" : "key missing"}</span>
          <span className={`pill ${apis.youcom ? "green" : "red"}`}>You.com {apis.youcom ? "connected" : "key missing"}</span>
        </p>
      )}
      {msg && <p className="muted">{msg}</p>}
      {progress && (
        <div className="progress">
          <span className="muted">Reading tender documents with You.com: {progress.done}/{progress.total}</span>
          <div className="bar2"><i style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
        </div>
      )}
      {warn.length > 0 && <p className="amber small">{warn.join(" · ")}</p>}

      {tenders.length > 0 && (
        <section className="d-stats t-stats">
          <div className="d-card stat"><div className="stat-main"><small>Open tenders</small><b>{openCount}</b></div></div>
          <div className="d-card stat"><div className="stat-main"><small>High win chance</small><b className="green">{high}</b></div></div>
          <div className="d-card stat"><div className="stat-main"><small>Closed (hidden)</small><b>{tenders.filter(t => t.status === "closed").length}</b></div></div>
        </section>
      )}

      <div className="filters">
        <input type="search" placeholder="Filter tenders…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 220 }} />
        <select value={view} onChange={e => setView(e.target.value as View)}>
          <option value="open">Open tenders</option><option value="all">All</option><option value="closed">Closed</option>
        </select>
        <select value={chance} onChange={e => setChance(e.target.value)}>
          <option value="">Any win chance</option><option>High</option><option>Medium</option><option>Low</option>
        </select>
        <select value={portal} onChange={e => setPortal(e.target.value)}>
          <option value="">All portals</option>
          {portals.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {list.map((t, i) => <TenderCard key={t.id} t={t} rank={i + 1} />)}
      {list.length === 0 && (
        <p className="muted">
          {tenders.length ? "No tenders match these filters." : "No tenders yet. Click “Find matching tenders”."}
        </p>
      )}
    </>
  );
}

function TenderCard({ t, rank }: { t: Tender; rank: number }) {
  const f = t.facts || {};
  const w = t.win;
  const unread = t.read_status === "pending";
  return (
    <div className={`card tender ${t.status === "closed" ? "na" : ""}`}>
      <div className="tender-head">
        <div>
          <h3><span className="muted">#{rank}</span> {t.title}</h3>
          <div>
            <span className="pill">{t.source}</span>
            {f.bid_no && <span className="pill">{f.bid_no}</span>}
            {t.org && <span className="pill">{t.org}</span>}
            {t.found_via && <span className="pill muted">via {t.found_via}</span>}
            {t.demo && <span className="pill sample">Sample</span>}
          </div>
        </div>
        {w ? (
          <div className={`win ${winCls(w.label)}`}>
            <small>{w.label === "Closed" ? "" : "Win chance"}</small>
            <b>{w.label}</b>
            {w.label !== "Closed" && <span>{w.score}</span>}
          </div>
        ) : (
          <div className="win"><small>{unread ? "Not read yet" : "Not scored"}</small></div>
        )}
      </div>

      <div className="facts">
        {closesLabel(t) && <span className={(f.days_left ?? 99) < 3 ? "amber" : ""}>{closesLabel(t)}</span>}
        {t.status === "unverified" && <span className="amber">Closing date not found, verify on portal</span>}
        {f.value_cr != null && <span>Value {crore(f.value_cr)}</span>}
        {f.emd_rupees != null && <span>EMD {inr(f.emd_rupees)}</span>}
        {f.pincode && <span>PIN {f.pincode}</span>}
      </div>

      {w && w.reasons.length > 0 && (
        <ul className="reasons">
          {w.reasons.slice(0, 4).map((r, k) => <li key={k} className={r.level}>{r.msg}</li>)}
        </ul>
      )}
      {!w && <p className="muted">{t.snippet}</p>}

      <div className="row">
        <Link href={`/tenders/${t.id}`}><button className="primary">Open workspace</button></Link>
        {t.link.startsWith("http") && (
          <a href={t.link} target="_blank" rel="noopener noreferrer"><button>Official page ↗</button></a>
        )}
        {samplePdf(t) && <a href={samplePdf(t)} target="_blank" rel="noopener noreferrer"><button>Sample PDF ↗</button></a>}
      </div>
    </div>
  );
}
