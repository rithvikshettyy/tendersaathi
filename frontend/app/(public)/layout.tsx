"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { tokenStore } from "@/lib/api";
import "./public.css";

const LINKS = [["/features", "Features"], ["/how-it-works", "How it works"], ["/about", "About"]] as const;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [authed, setAuthed] = useState(false);
  useEffect(() => { setAuthed(!!tokenStore.get()); }, []);

  return (
    <div className="pub">
      <nav className="pnav">
        <Link href="/" className="brand">Tender<span>Saathi</span></Link>
        <div className="links">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={`lnk ${path === href ? "on" : ""}`}>{label}</Link>
          ))}
          {authed ? (
            <Link href="/dashboard"><button className="primary">Dashboard</button></Link>
          ) : (
            <>
              <Link href="/login"><button>Log in</button></Link>
              <Link href="/signup"><button className="primary">Sign up</button></Link>
            </>
          )}
        </div>
      </nav>
      <main>{children}</main>
      <footer className="pfoot">
        <span>© TenderSaathi · Tender data comes from public search results. Verify on the official portal.</span>
        <span>
          <Link href="/features">Features</Link><Link href="/how-it-works">How it works</Link>
          <Link href="/about">About</Link><Link href="/login">Log in</Link>
        </span>
      </footer>
    </div>
  );
}
