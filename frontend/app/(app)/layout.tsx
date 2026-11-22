"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate, useAuth } from "@/lib/auth";
import { TendersProvider } from "@/lib/tenders-context";
import ChatWidget from "@/components/ChatWidget";
import Topbar from "@/components/Topbar";
import { IconChat, IconDashboard, IconProfile, IconSchemes, IconTenders } from "@/components/icons";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/tenders", label: "Tenders", Icon: IconTenders },
  { href: "/schemes", label: "Schemes", Icon: IconSchemes },
  { href: "/profile", label: "Profile", Icon: IconProfile },
] as const;

function heading(path: string, name: string): [string, string] {
  if (path.startsWith("/tenders")) return ["Tenders", "Find, check and track tenders"];
  if (path.startsWith("/schemes")) return ["Schemes", "Benefits matched to your profile"];
  if (path.startsWith("/profile")) return ["Profile", "Your company details"];
  if (path.startsWith("/chat")) return ["Assistant", "Ask about your tenders"];
  return ["Dashboard", `Welcome back, ${name.split(" ")[0] || name}`];
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { me, offline } = useAuth();
  const [title, subtitle] = heading(path, me.name);
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Tender<span>Saathi</span></div>
        <nav aria-label="Main">
          {LINKS.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={path.startsWith(href) ? "on" : ""}>
              <Icon /> {label}
            </Link>
          ))}
        </nav>
        <div className="side-card">
          <b>Need a hand?</b>
          <p>Ask about eligibility, documents or schemes. Answers can be read aloud.</p>
          <button type="button" onClick={() => window.dispatchEvent(new Event("ts:open-chat"))}><IconChat width={16} height={16} /> Ask TenderSaathi</button>
        </div>
      </aside>
      <div className="main">
        <Topbar title={title} subtitle={subtitle} />
        <main className="content">
          {offline && <div className="offline">You&apos;re signed in, but the TenderSaathi server can&apos;t be reached right now, so tenders and profile data can&apos;t load yet.</div>}
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate requireProfile><TendersProvider><Shell>{children}</Shell></TendersProvider></AuthGate>;
}
