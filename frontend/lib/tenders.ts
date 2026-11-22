import type { Company, Tender } from "./types";

/** SQLite CURRENT_TIMESTAMP is UTC without a zone marker. */
export const parseUtc = (s: string) => new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");

export function relTime(s: string): string {
  const t = parseUtc(s).getTime();
  if (isNaN(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

/** Whole days until a deadline written like 30-12-2026, 30/12/26 or 2026-12-30. Null if unreadable. */
export function daysLeft(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const m = deadline.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/) ;
  let y: number, mo: number, d: number;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
  else {
    const iso = deadline.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!iso) return null;
    y = +iso[1]; mo = +iso[2]; d = +iso[3];
  }
  const target = new Date(y, mo - 1, d).getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86400000);
}

export interface Alert {
  id: string;
  kind: "deadline" | "risk" | "new" | "profile";
  text: string;
  href: string;
  when?: string;
}

/** Real signals only: deadlines, risky buyers, fresh tenders and gaps in the profile. */
export function buildAlerts(tenders: Tender[], me: Company): Alert[] {
  const out: Alert[] = [];
  for (const t of tenders) {
    const n = daysLeft(t.deadline);
    if (n !== null && n >= 0 && n <= 7) {
      out.push({ id: `d${t.id}`, kind: "deadline", href: `/tenders/${t.id}`, when: n === 0 ? "today" : `in ${n} day${n > 1 ? "s" : ""}`,
        text: `Deadline ${n === 0 ? "today" : `in ${n} day${n > 1 ? "s" : ""}`}: ${t.title}` });
    }
    if (t.intel?.risk_level === "High") {
      out.push({ id: `r${t.id}`, kind: "risk", href: `/tenders/${t.id}`, text: `High-risk buyer: ${t.org || t.title}` });
    }
  }
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const fresh = tenders.filter(t => parseUtc(t.found).getTime() >= startOfToday.getTime());
  if (fresh.length) out.push({ id: "new", kind: "new", href: "/tenders", text: `${fresh.length} new tender${fresh.length > 1 ? "s" : ""} found today`, when: relTime(fresh[0].found) });
  if ((me.size === "micro" || me.size === "small") && !me.udyam) {
    out.push({ id: "udyam", kind: "profile", href: "/profile", text: "Add your Udyam number to claim MSE benefits" });
  }
  return out;
}

export const verdictOf = (t: Tender): "high" | "medium" | "low" | null =>
  !t.analysis ? null : t.analysis.verdict === "Well aligned" ? "high" : t.analysis.verdict === "Partially aligned" ? "medium" : "low";
