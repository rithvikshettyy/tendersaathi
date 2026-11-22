"use client";
/**
 * Whole-site language switch. Visible text is translated in place with Sarvam (backend /api/translate,
 * same model as the chat) and restored when switching back to English. New text (React updates, new pages)
 * is picked up by a MutationObserver. Mark anything that must stay as-is with data-no-translate.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export const LANGS: [string, string][] = [
  ["en", "English"], ["hi", "हिन्दी"], ["bn", "বাংলা"], ["ta", "தமிழ்"], ["te", "తెలుగు"], ["kn", "ಕನ್ನಡ"],
  ["ml", "മലയാളം"], ["mr", "मराठी"], ["gu", "ગુજરાતી"], ["pa", "ਪੰਜਾਬੀ"], ["od", "ଓଡ଼ିଆ"],
];
const KEY = "ts_lang";
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "SVG", "INPUT"]);
const HAS_WORD = /[A-Za-z]{2}/;
const ATTRS = ["placeholder", "title", "aria-label"] as const;
const BATCH = 120;

interface Ctx { lang: string; setLang: (l: string) => void; busy: boolean; error: string }
const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, busy: false, error: "" });
export const useLang = () => useContext(LangCtx);

/* ---------- client cache (per language, survives reloads) ---------- */
const mem = new Map<string, Map<string, string>>();
function cacheFor(lang: string) {
  let m = mem.get(lang);
  if (!m) {
    m = new Map();
    try { Object.entries(JSON.parse(localStorage.getItem(`ts_tr:${lang}`) || "{}") as Record<string, string>).forEach(([k, v]) => m!.set(k, v)); } catch { /* ignore */ }
    mem.set(lang, m);
  }
  return m;
}
function persist(lang: string) {
  try {
    const entries = [...cacheFor(lang)].slice(-3000);
    localStorage.setItem(`ts_tr:${lang}`, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* storage full or blocked */ }
}

/* ---------- DOM bookkeeping ---------- */
const origText = new WeakMap<Text, string>();   // English source of a text node
const shownText = new WeakMap<Text, string>();  // what we last wrote into it
const origAttr = new WeakMap<Element, Record<string, string>>();
const touched = new Set<Text>();
const touchedEls = new Set<Element>();

function skip(el: Element | null) {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName.toUpperCase()) || e.hasAttribute("data-no-translate") || e.getAttribute("translate") === "no" ||
        (e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

/** English source for a node; if React replaced the text since we translated it, that is the new source. */
function sourceOf(n: Text) {
  const v = n.nodeValue ?? "";
  if (shownText.has(n) && v !== shownText.get(n)) { origText.set(n, v); shownText.delete(n); }
  if (!origText.has(n)) origText.set(n, v);
  return origText.get(n)!;
}

function collect(root: Node) {
  const nodes: Text[] = [];
  const els: Element[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const src = sourceOf(n).trim();
    if (src && HAS_WORD.test(src) && !skip(n.parentElement)) nodes.push(n);
  }
  if (root instanceof Element || root instanceof Document) {
    const scope = root instanceof Document ? root.body : root;
    scope.querySelectorAll("[placeholder],[title],[aria-label]").forEach(e => { if (!skip(e.parentElement) && !e.hasAttribute("data-no-translate")) els.push(e); });
  }
  return { nodes, els };
}

function attrSources(e: Element) {
  let o = origAttr.get(e);
  if (!o) { o = {}; origAttr.set(e, o); }
  for (const a of ATTRS) {
    const v = e.getAttribute(a);
    if (v && !(a in o)) o[a] = v;
  }
  return o;
}

async function fetchTranslations(lang: string, texts: string[]): Promise<{ missing: number; error?: string }> {
  const cache = cacheFor(lang);
  const need = [...new Set(texts)].filter(t => !cache.has(t));
  let missing = 0, error: string | undefined;
  for (let i = 0; i < need.length; i += BATCH) {
    const chunk = need.slice(i, i + BATCH);
    try {
      const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, texts: chunk.map(t => t.slice(0, 600)) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { error = data.detail || `Translation failed (${res.status})`; missing += chunk.length; continue; }
      (data.translations as string[]).forEach((tr, k) => { if (tr && tr !== chunk[k]) cache.set(chunk[k], tr); });
      missing += data.missing || 0;
    } catch { error = "Translation service unreachable"; missing += chunk.length; }
  }
  if (need.length) persist(lang);
  return { missing, error };
}

function apply(lang: string, nodes: Text[], els: Element[]) {
  const cache = cacheFor(lang);
  for (const n of nodes) {
    const src = origText.get(n) ?? n.nodeValue ?? "";
    const core = src.trim();
    const tr = lang === "en" ? undefined : cache.get(core);
    const next = tr ? src.replace(core, () => tr) : src;
    if (n.nodeValue !== next) n.nodeValue = next;
    if (tr) { shownText.set(n, next); touched.add(n); }
  }
  for (const e of els) {
    const o = attrSources(e);
    for (const [a, src] of Object.entries(o)) {
      const tr = lang === "en" ? undefined : cache.get(src.trim());
      const next = tr ?? src;
      if (e.getAttribute(a) !== next) e.setAttribute(a, next);
    }
    touchedEls.add(e);
  }
}

function restoreAll() {
  touched.forEach(n => { const o = origText.get(n); if (o !== undefined && n.isConnected) n.nodeValue = o; shownText.delete(n); });
  touched.clear();
  touchedEls.forEach(e => { const o = origAttr.get(e); if (o && e.isConnected) Object.entries(o).forEach(([a, v]) => e.setAttribute(a, v)); });
  touchedEls.clear();
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const langRef = useRef("en");
  const running = useRef(false);
  const again = useRef(false);

  const pass = useCallback(async () => {
    if (running.current) { again.current = true; return; }
    running.current = true;
    try {
      do {
        again.current = false;
        const l = langRef.current;
        if (l === "en") break;
        const { nodes, els } = collect(document.body);
        const texts = [...nodes.map(n => (origText.get(n) ?? "").trim()),
          ...els.flatMap(e => Object.values(attrSources(e)).map(v => v.trim()))].filter(t => HAS_WORD.test(t));
        const cache = cacheFor(l);
        apply(l, nodes, els);                           // instant for cached strings
        if (texts.some(t => !cache.has(t))) {
          setBusy(true);
          const r = await fetchTranslations(l, texts);
          setError(r.error ?? "");
          if (langRef.current === l) apply(l, nodes, els);
        }
      } while (again.current);
    } finally { running.current = false; setBusy(false); }
  }, []);

  const setLang = useCallback((l: string) => {
    langRef.current = l;
    setLangState(l);
    setError("");
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    document.documentElement.lang = l === "od" ? "or" : l;
    restoreAll();
    if (l !== "en") pass();
  }, [pass]);

  useEffect(() => {
    let saved = "en";
    try { saved = localStorage.getItem(KEY) || "en"; } catch { /* ignore */ }
    if (saved !== "en" && LANGS.some(([k]) => k === saved)) setLang(saved);
    let t: ReturnType<typeof setTimeout> | undefined;
    const obs = new MutationObserver(() => {
      if (langRef.current === "en") return;
      clearTimeout(t);
      t = setTimeout(pass, 250);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    return () => { obs.disconnect(); clearTimeout(t); };
  }, [pass, setLang]);

  return <LangCtx.Provider value={{ lang, setLang, busy, error }}>{children}</LangCtx.Provider>;
}

/** Nav bar button: globe + current language, opens a list of languages (names shown in their own script). */
export function LanguageSwitch({ className = "lang-switch" }: { className?: string }) {
  const { lang, setLang, busy, error } = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const label = LANGS.find(([k]) => k === lang)?.[1] ?? "English";
  return (
    <div className={`lang-wrap ${className}`} ref={box} data-no-translate>
      <button type="button" className="lang-btn" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        title={error || (busy ? "Translating…" : "Change language")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        <span>{label}</span>
        {busy && <i className="lang-spin" aria-label="Translating" />}
      </button>
      {open && (
        <ul className="lang-menu" role="listbox">
          {LANGS.map(([k, v]) => (
            <li key={k}><button type="button" role="option" aria-selected={k === lang} className={k === lang ? "on" : ""}
              onClick={() => { setLang(k); setOpen(false); }}>{v}</button></li>
          ))}
          {error && <li className="lang-err">{error}</li>}
        </ul>
      )}
    </div>
  );
}
