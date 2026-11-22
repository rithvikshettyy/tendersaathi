export interface Profile {
  name: string; gstin: string; udyam: string; state: string; city: string;
  size: string; turnover_cr: number; years: number; certifications: string;
  products: string; services: string; women_owned: boolean; startup: boolean;
}
export interface Company extends Profile { id: number; email: string; categories: string[] }
export interface Flag { level: "green" | "amber" | "red"; msg: string }
export interface Analysis { verdict: string; scope_match_pct: number; flags: Flag[]; terms: Record<string, unknown> }
export interface Intel {
  subject: string; risk_level: "Low" | "Medium" | "High"; risk_score: number; note: string;
  flags: { signal: string; source: string; text: string }[];
  competitors: { name: string; mentions: number }[];
  past_offers: { amount: string; context: string; source: string }[];
}
export interface Tender {
  id: number; title: string; link: string; snippet: string; source: string; kind: string;
  org: string; category: string; deadline: string; found: string;
  analysis: Analysis | null; intel: Intel | null;
}
export interface Readiness {
  score: number; grade: string; days_left: number | null; gaps: string[];
  breakdown: { documents: number; profile: number; alignment: number; timing: number };
  items: { key: string; label: string; weight: number }[]; checked: Record<string, boolean>;
}
export interface Scheme { name: string; desc: string; url: string; applicable: boolean }
export interface FillPack { tender: string; link: string; fields: Record<string, string | number>; steps: string[] }
