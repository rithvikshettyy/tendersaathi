"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { tokenStore } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { LanguageSwitch } from "@/lib/i18n";
import "./public.css";

const LINKS = [["/features", "Features"], ["/how-it-works", "How it works"], ["/about", "About"]] as const;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);          // mobile menu
  useEffect(() => { setAuthed(!!tokenStore.get()); }, []);
  useEffect(() => { setOpen(false); }, [path]);      // close after navigating
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const cta = authed ? (
    <Link href="/dashboard"><button className="primary">Dashboard</button></Link>
  ) : (
    <>
      <Link href="/login"><button>Log in</button></Link>
      <Link href="/signup"><button className="primary">Sign up</button></Link>
    </>
  );

  return (
    <div className="pub">
      <nav className="pnav">
        <Link href="/" className="brand">Tender<span>Saathi</span></Link>
        <div className="links">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={`lnk ${path === href ? "on" : ""}`}>{label}</Link>
          ))}
          <LanguageSwitch className="lang-switch sm" />
          <ThemeToggle className="theme-toggle sm" />
          <span className="cta-group">{cta}</span>
          <button type="button" className="menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(o => !o)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        {open && (
          <div className="pn-sheet" role="menu">
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href} role="menuitem" className={`lnk ${path === href ? "on" : ""}`}>{label}</Link>
            ))}
            <div className="pn-cta">{cta}</div>
          </div>
        )}
      </nav>
      <main>{children}</main>
      <footer className="pfoot">
        <span>© TenderSaathi · Tender data comes from public search results. Verify on the official portal.</span>
        <span className="pf-links">
          <Link href="/features">Features</Link><Link href="/how-it-works">How it works</Link>
          <Link href="/about">About</Link><Link href="/login">Log in</Link>
        </span>
      </footer>
    </div>
  );
}
