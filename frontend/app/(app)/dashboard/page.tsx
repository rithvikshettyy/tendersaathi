"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Tender } from "@/lib/types";

export default function Dashboard() {
  const { me } = useAuth();
  const [tenders, setTenders] = useState<Tender[] | null>(null);
  useEffect(() => { api<Tender[]>("/tenders").then(setTenders); }, []);

  const list = tenders ?? [];
  const count = (f: (t: Tender) => boolean) => list.filter(f).length;
  const byCat = Object.entries(list.reduce<Record<string, number>>((m, t) => ({ ...m, [t.category]: (m[t.category] || 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]);
  const max = byCat[0]?.[1] || 1;
  const risky = list.filter(t => t.intel?.risk_level === "High");

  return (
    <>
      <h2>Welcome, {me.name}</h2>
      <p className="muted">Your tender categories: {me.categories.map(c => <span className="pill" key={c}>{c}</span>)}</p>

      <div className="stats">
        <div className="stat"><span className="muted">Tenders tracked</span><b>{list.length}</b></div>
        <div className="stat"><span className="muted">Government</span><b>{count(t => t.kind === "government")}</b></div>
        <div className="stat"><span className="muted">Private / aggregator</span><b>{count(t => t.kind === "private/aggregator")}</b></div>
        <div className="stat"><span className="muted">Well aligned</span><b className="green">{count(t => t.analysis?.verdict === "Well aligned")}</b></div>
        <div className="stat"><span className="muted">Not aligned</span><b className="red">{count(t => t.analysis?.verdict === "Not aligned")}</b></div>
        <div className="stat"><span className="muted">High-risk buyers</span><b className="amber">{risky.length}</b></div>
      </div>

      <div className="card">
        <h3>Tenders by category</h3>
        {byCat.length === 0 && <p className="muted">Nothing yet. <Link href="/tenders">Find tenders</Link>.</p>}
        {byCat.map(([c, n]) => (
          <div key={c} style={{ margin: "8px 0" }}>
            <div className="bar"><span>{c}</span><span className="muted">{n}</span></div>
            <div className="bar2"><i style={{ width: `${(n / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Latest tenders</h3>
        {list.slice(0, 5).map(t => (
          <p key={t.id}><Link href={`/tenders/${t.id}`}>{t.title}</Link> <span className="pill">{t.kind}</span></p>
        ))}
        {tenders && list.length === 0 && <p className="muted">No tenders yet.</p>}
      </div>
    </>
  );
}
