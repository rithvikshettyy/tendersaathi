"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { useTenders } from "@/lib/tenders-context";
import { buildAlerts } from "@/lib/tenders";
import { IconBell, IconLogout, IconProfile, IconSearch } from "./icons";
import ThemeToggle from "./ThemeToggle";
import { isEnabled, setEnabled } from "@/lib/demo";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";

export default function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  const router = useRouter();
  const { me, logout } = useAuth();
  const { tenders } = useTenders();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [sample, setSample] = useState(true);
  useEffect(() => { setSample(isEnabled()); }, [menu]);
  const box = useRef<HTMLDivElement>(null);
  const alerts = useMemo(() => buildAlerts(tenders, me), [tenders, me]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  function search(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/tenders?q=${encodeURIComponent(term)}` : "/tenders");
  }

  return (
    <header className="topbar">
      <div className="tb-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <form className="tb-search" onSubmit={search} role="search">
        <IconSearch width={16} height={16} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tenders, categories, keywords…" aria-label="Search tenders" />
      </form>
      <Link href="/dashboard#alerts" className="tb-icon" aria-label={`${alerts.length} notifications`}>
        <IconBell />
        {alerts.length > 0 && <span className="tb-badge">{alerts.length > 9 ? "9+" : alerts.length}</span>}
      </Link>
      <ThemeToggle />
      <div className="tb-user" ref={box}>
        <button type="button" onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-haspopup="menu">
          <span className="avatar">{initials(me.name)}</span>
          <span className="tb-who"><b>{me.name}</b><small>{me.categories[0] || `${me.size} enterprise`}</small></span>
        </button>
        {menu && (
          <div className="tb-menu" role="menu">
            <Link href="/profile" role="menuitem" onClick={() => setMenu(false)}><IconProfile width={16} height={16} /> Profile</Link>
            <label className="tb-switch" title="Fill empty screens with generated example tenders, risk analysis and bid scores">
              <input type="checkbox" checked={sample} onChange={e => { setSample(e.target.checked); setEnabled(e.target.checked); }} /> Sample data
            </label>
            <button type="button" role="menuitem" onClick={logout}><IconLogout width={16} height={16} /> Log out</button>
          </div>
        )}
      </div>
    </header>
  );
}
