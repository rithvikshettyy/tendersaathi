"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate, useAuth } from "@/lib/auth";

const LINKS = [
  ["/dashboard", "Dashboard"],
  ["/tenders", "Tenders"],
  ["/schemes", "Schemes"],
  ["/chat", "Chat"],
  ["/profile", "Profile"],
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { me, logout } = useAuth();
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
      <main className="content">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate><Shell>{children}</Shell></AuthGate>;
}
