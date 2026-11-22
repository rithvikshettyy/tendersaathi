"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate, useAuth } from "@/lib/auth";
import ChatWidget from "@/components/ChatWidget";

const LINKS = [
  ["/dashboard", "Dashboard"],
  ["/tenders", "Tenders"],
  ["/schemes", "Schemes"],
  ["/profile", "Profile"],
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { me, logout, offline } = useAuth();
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Tender<span>Saathi</span></div>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className={path.startsWith(href) ? "on" : ""}>{label}</Link>
        ))}
        <div className="who">
          {me.name}<br />
          <a href="#" onClick={e => { e.preventDefault(); logout(); }}>Log out</a>
        </div>
      </aside>
      <main className="content">
        {offline && <div className="offline">You're signed in, but the TenderSaathi server can't be reached right now, so tenders and profile data can't load yet.</div>}
        {children}
      </main>
      <ChatWidget />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate requireProfile><Shell>{children}</Shell></AuthGate>;
}
