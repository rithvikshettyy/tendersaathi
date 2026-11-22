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
export interface Win { score: number; label: "High" | "Medium" | "Low" | "Closed"; status: string; reasons: Flag[] }
export interface Facts {
  deadline?: string; days_left?: number; value_cr?: number; emd_rupees?: number; org?: string; title?: string;
  bid_no?: string; pincode?: string; matched_terms?: string[]; in_your_state?: boolean; in_your_city?: boolean;
  mse_preference?: boolean; read_note?: string;
}
export interface Tender {
  id: number; title: string; link: string; snippet: string; source: string; kind: string;
  org: string; category: string; deadline: string; found: string; ext_id?: string | null;
  score?: number | null; score_parts?: Record<string, unknown> | null;
  analysis: Analysis | null; intel: Intel | null;
  /** Sample (synthetic) tender shown when live data is not available (frontend lib/demo.ts). */
  demo?: boolean;
  /** Filled by the backend read/score pipeline; absent on frontend sample tenders. */
  facts?: Facts | null; win?: Win | null; win_score?: number;
  /** active | unverified | closed | unreadable | "" (not read yet) */
  status?: string;
  read_status?: "pending" | "done" | "limited" | "manual";
  reader?: string; found_via?: string;
}
export interface SearchResult {
  found: number; new: number; pending: number; gem?: number; serpapi: number; youcom: number; warnings: string[];
  demo?: boolean;
}
export interface ReadResult { processed: number; remaining: number; read_by: Record<string, number> }
export interface Readiness {
  score: number; grade: string; days_left: number | null; gaps: string[];
  breakdown: { documents: number; profile: number; alignment: number; timing: number };
  items: { key: string; label: string; weight: number }[]; checked: Record<string, boolean>;
}
export interface Scheme { name: string; desc: string; url: string; applicable: boolean }
export interface FillPack { tender: string; link: string; fields: Record<string, string | number>; steps: string[] }
