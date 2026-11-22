import type { Tender } from "./types";

export const inr = (n?: number) =>
  n == null ? "" : n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${Math.round(n).toLocaleString("en-IN")}`;

export const crore = (cr?: number) => (cr == null ? "" : inr(cr * 1e7));

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

export function closesLabel(t: Tender) {
  const f = t.facts;
  if (!f?.deadline) return "";
  const d = f.days_left ?? 0;
  if (d < 0) return `Closed ${fmtDate(f.deadline)}`;
  return `Closes ${fmtDate(f.deadline)} · ${d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"} left`}`;
}

export const winCls = (label?: string) =>
  label === "High" ? "green" : label === "Medium" ? "amber" : label === "Low" || label === "Closed" ? "red" : "";

/** Backend sample GeM-format PDFs ("Load sample tenders") have links like gem-sample:01-desktop-computers.pdf.
 *  (Frontend-only sample tenders from lib/demo.ts use demo:N links and have no PDF.) */
const SAMPLE = "gem-sample:";
export const samplePdf = (t: Tender) =>
  t.link.startsWith(SAMPLE) ? `/api/demo/pdf/${encodeURIComponent(t.link.slice(SAMPLE.length))}` : "";

/** Open = scored active/unverified, or not scored yet (unread, or a frontend sample tender) and not past its deadline. */
export function isOpen(t: Tender) {
  if (t.status) return t.status === "active" || t.status === "unverified";
  const d = /^\d{4}-\d{2}-\d{2}/.test(t.deadline || "") ? Date.parse(t.deadline.slice(0, 10)) : NaN;
  return isNaN(d) || d >= new Date().setHours(0, 0, 0, 0);
}
