/**
 * Saves the user's working data to Supabase so it survives backend resets and powers analytics:
 * tenders (with PDF analysis, buyer risk, checklist and bid score), chat history, and usage events.
 *
 * It listens to the shared API client (see `tap` in lib/api.ts), so every screen is covered
 * without each one having to save anything. Only for Google (Supabase) logins, since Supabase
 * row-level security needs that identity. Everything is best-effort: a failure never affects the app.
 */
import { getSupabase, supabaseConfigured } from "./supabase";
import { parseUtc } from "./tenders";
import type { Intel, Analysis, Readiness, Tender } from "./types";

// Google (Supabase) logins only. Read directly to avoid importing api.ts (which imports this file).
const usable = () => {
  try { return supabaseConfigured && localStorage.getItem("ts_provider") === "supabase"; } catch { return false; }
};
type Row = Record<string, unknown>;

async function uid(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

export const extId = (id: number, demo?: boolean) => `${demo || id < 0 ? "d" : "b"}:${id}`;

const synced = new Map<string, string>();   // ext_id -> last payload written, to skip unchanged rows

function listRow(user: string, t: Tender): Row {
  const r: Row = {
    user_id: user, ext_id: extId(t.id, t.demo), title: t.title ?? "", link: t.link ?? "", snippet: t.snippet ?? "",
    source: t.source ?? "", kind: t.kind ?? "", org: t.org ?? "", category: t.category ?? "",
    deadline: t.deadline ?? "", demo: !!t.demo,
  };
  const f = t.found ? parseUtc(t.found) : null;
  if (f && !isNaN(f.getTime())) r.found_at = f.toISOString();
  // Results are only included when present, so an empty list from a reset backend can't erase saved ones.
  if (t.analysis) r.analysis = t.analysis;
  if (t.intel) r.intel = t.intel;
  return r;
}

/** Upsert rows, grouping by which columns they carry (PostgREST needs matching keys in a batch). */
async function upsertTenders(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = Object.keys(r).sort().join(",");
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const g of groups.values()) {
    const { error } = await getSupabase().from("tenders").upsert(g, { onConflict: "user_id,ext_id" });
    if (error) throw error;
  }
}

export const cloud = {
  /** Mirror the tender list (and any analysis / risk results already attached). */
  async tenders(list: Tender[]) {
    if (!usable() || !list.length) return;
    try {
      const user = await uid();
      if (!user) return;
      const rows = list.map(t => listRow(user, t)).filter(r => {
        const h = JSON.stringify(r);
        return synced.get(String(r.ext_id)) !== h;
      });
      if (!rows.length) return;
      await upsertTenders(rows);
      rows.forEach(r => synced.set(String(r.ext_id), JSON.stringify(r)));
    } catch { /* best effort */ }
  },

  /** Update one tender's computed fields (analysis, intel, checklist, readiness_score). */
  async patch(id: number, fields: { analysis?: Analysis; intel?: Intel; checklist?: Record<string, boolean>; readiness_score?: number }) {
    if (!usable()) return;
    try {
      const user = await uid();
      if (!user) return;
      await upsertTenders([{ user_id: user, ext_id: extId(id), ...fields }]);
      synced.delete(extId(id));   // let the next list sync refresh the base columns too
    } catch { /* best effort */ }
  },

  async chat(question: string, answer: string, lang: string, sources: string[]) {
    if (!usable()) return;
    try {
      const user = await uid();
      if (!user) return;
      const now = Date.now();
      await getSupabase().from("chat_messages").insert([
        { user_id: user, role: "user", content: question, lang, created_at: new Date(now - 1).toISOString() },
        { user_id: user, role: "assistant", content: answer, lang, sources, created_at: new Date(now).toISOString() },
      ]);
    } catch { /* best effort */ }
  },

  /** One usage event, for analytics. */
  async track(type: string, props: Row = {}) {
    if (!usable()) return;
    try {
      const user = await uid();
      if (!user) return;
      await getSupabase().from("events").insert({ user_id: user, type, props });
    } catch { /* best effort */ }
  },
};

/** Called by the API client after every successful call. Mirrors whatever the call produced. */
export function tap(path: string, method: string, body: unknown, result: unknown) {
  if (!usable()) return;
  const m = path.match(/^\/tenders\/(-?\d+)\/(\w+)/);
  if (method === "GET" && path === "/tenders" && Array.isArray(result)) { void cloud.tenders(result as Tender[]); return; }
  if (m) {
    const id = Number(m[1]), action = m[2];
    if (action === "analyze") {
      const a = result as Analysis;
      void cloud.patch(id, { analysis: a });
      void cloud.track("pdf_analysis", { tender: extId(id), verdict: a?.verdict, scope_match_pct: a?.scope_match_pct });
    } else if (action === "intel") {
      const i = result as Intel;
      void cloud.patch(id, { intel: i });
      void cloud.track("risk_check", { tender: extId(id), risk_level: i?.risk_level, risk_score: i?.risk_score });
    } else if (action === "readiness" && result) {
      const r = result as Readiness;
      void cloud.patch(id, { checklist: r.checked, readiness_score: r.score });
      if (method === "PUT") void cloud.track("checklist_update", { tender: extId(id), score: r.score, grade: r.grade });
    } else if (action === "read" && result) {
      void cloud.tenders([result as Tender]);
      void cloud.track("tender_read", { tender: extId(id) });
    }
    return;
  }
  if (method !== "POST") return;
  if (path.startsWith("/tenders/search") || path.startsWith("/tenders/read") || path.startsWith("/tenders/demo")) {
    const r = (result ?? {}) as Row;
    void cloud.track("tender_search", { path: path.split("?")[0], found: r.found ?? r.loaded ?? null, new: r.new ?? null, demo: !!r.demo });
  } else if (path === "/tenders/upload" && result) {
    void cloud.tenders([result as Tender]);
    void cloud.track("tender_upload");
  } else if (path === "/tenders") {
    void cloud.track("tender_added");
  } else if (path === "/chat") {
    const b = (body ?? {}) as { question?: string; lang?: string };
    const r = (result ?? {}) as { answer?: string; sources?: string[] };
    if (b.question && r.answer) {
      void cloud.chat(b.question, r.answer, b.lang ?? "en", r.sources ?? []);
      void cloud.track("chat", { lang: b.lang ?? "en" });
    }
  } else if (path.startsWith("/stt")) {
    void cloud.track("voice_input");
  } else if (path === "/tts") {
    void cloud.track("voice_reply", { lang: ((body ?? {}) as { lang?: string }).lang ?? "en" });
  }
}
