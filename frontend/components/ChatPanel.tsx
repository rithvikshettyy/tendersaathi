"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import VoiceNote from "./VoiceNote";
import { useLang } from "@/lib/i18n";
import { useVoiceInput } from "@/lib/voice";

interface Msg { role: "user" | "assistant"; content: string; sources?: string[]; error?: boolean; fresh?: boolean; lang?: string }
export interface ChatPanelHandle { focus: () => void }

const SUGGESTIONS = [
  "Which government schemes apply to me?",
  "What documents do I need for a bid?",
  "Am I eligible for MSE benefits?",
];

/** The RAG chat (profile, tenders, PDFs, schemes). Used by the Chat page and the floating widget. */
const ChatPanel = forwardRef<ChatPanelHandle, { compact?: boolean }>(function ChatPanel({ compact = false }, ref) {
  const [langs, setLangs] = useState<Record<string, string>>({ en: "English" });
  const site = useLang().lang;
  const [lang, setLang] = useState(site);
  useEffect(() => { setLang(site); }, [site]);   // replies follow the site language unless changed here
  const [log, setLog] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);   // read new replies aloud
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));
  useEffect(() => { try { setAuto(localStorage.getItem("ts_voice") === "1"); } catch { /* storage blocked */ } }, []);
  const toggleAuto = (v: boolean) => { setAuto(v); try { localStorage.setItem("ts_voice", v ? "1" : "0"); } catch { /* storage blocked */ } };
  useEffect(() => { api<Record<string, string>>("/langs").then(setLangs).catch(() => {}); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [log, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = log.filter(m => !m.error).map(({ role, content }) => ({ role, content }));
    setLog(l => [...l, { role: "user", content: question }]);
    setQ(""); setBusy(true);
    try {
      const r = await api<{ answer: string; sources: string[] }>("/chat", { body: { question, lang, history } });
      setLog(l => [...l, { role: "assistant", content: r.answer, sources: r.sources, fresh: true, lang }]);
    } catch (err) {
      setLog(l => [...l, { role: "assistant", content: (err as Error).message || "Chat is unavailable right now.", error: true }]);
    } finally { setBusy(false); }
  }

  // Voice input: the live transcript is appended to whatever was already typed; the user checks it and sends.
  const typedBefore = useRef("");
  const voice = useVoiceInput(lang, text => setQ([typedBefore.current, text].filter(Boolean).join(" ")));
  const toggleMic = () => {
    if (!voice.listening) typedBefore.current = q.trim();
    voice.toggle();
    input.current?.focus();
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (voice.listening) voice.stop(); send(q); };

  return (
    <div className={`chatpanel ${compact ? "compact" : ""}`}>
      <div className="chat-lang">
        <label htmlFor="chat-lang" className="muted">Reply in</label>
        <select id="chat-lang" value={lang} onChange={e => setLang(e.target.value)}>
          {Object.entries(langs).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="chk auto-voice" title="Play each new answer as a voice note">
          <input type="checkbox" checked={auto} onChange={e => toggleAuto(e.target.checked)} /> Voice replies
        </label>
      </div>
      <div className="chatlog" aria-live="polite">
        {log.length === 0 && (
          <div className="chat-empty">
            <p className="muted">Ask about your tenders, eligibility, documents or schemes, in any listed language.</p>
            <div className="chips-q">
              {SUGGESTIONS.map(s => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {log.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "u" : "b"} ${m.error ? "err" : ""}`} data-no-translate={m.error ? undefined : ""}>
            {m.content}
            {m.sources && m.sources.length > 0 && <><br /><small className="muted">Sources: {m.sources.join(", ")}</small></>}
            {m.role === "assistant" && !m.error && <VoiceNote text={m.content} lang={m.lang ?? lang} autoPlay={auto && !!m.fresh} />}
          </div>
        ))}
        {busy && <div className="bubble b muted">Thinking…</div>}
        <div ref={end} />
      </div>
      <form className="chatform" onSubmit={onSubmit}>
        <input ref={input} required placeholder={voice.listening ? "Listening…" : "Ask TenderSaathi…"} value={q}
          className={voice.listening ? "listening" : ""}
          onChange={e => { if (voice.listening) voice.stop(); setQ(e.target.value); }} />
        {voice.mode !== "none" && (
          <button type="button" className={`mic ${voice.listening ? "on" : ""}`} onClick={toggleMic} disabled={busy}
            aria-pressed={voice.listening} aria-label={voice.listening ? "Stop voice input" : "Speak your question"}
            title={voice.listening ? "Stop listening" : "Speak your question"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        )}
        <button className="primary" disabled={busy}>Send</button>
      </form>
      {(voice.listening || voice.error) && (
        <p className={`mic-hint ${voice.error ? "err" : ""}`} role="status">
          {voice.error || (voice.mode === "live"
            ? "Listening… your words appear above. Edit if needed, then press Enter to send."
            : "Listening… transcribing with Sarvam every few seconds (max 30 s). Press Enter to send.")}
        </p>
      )}
    </div>
  );
});

export default ChatPanel;
