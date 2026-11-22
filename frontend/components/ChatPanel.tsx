"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

interface Msg { role: "user" | "assistant"; content: string; sources?: string[]; error?: boolean }
export interface ChatPanelHandle { focus: () => void }

const SUGGESTIONS = [
  "Which government schemes apply to me?",
  "What documents do I need for a bid?",
  "Am I eligible for MSE benefits?",
];

/** The RAG chat (profile, tenders, PDFs, schemes). Used by the Chat page and the floating widget. */
const ChatPanel = forwardRef<ChatPanelHandle, { compact?: boolean }>(function ChatPanel({ compact = false }, ref) {
  const [langs, setLangs] = useState<Record<string, string>>({ en: "English" });
  const [lang, setLang] = useState("en");
  const [log, setLog] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));
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
      setLog(l => [...l, { role: "assistant", content: r.answer, sources: r.sources }]);
    } catch (err) {
      setLog(l => [...l, { role: "assistant", content: (err as Error).message || "Chat is unavailable right now.", error: true }]);
    } finally { setBusy(false); }
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(q); };

  return (
    <div className={`chatpanel ${compact ? "compact" : ""}`}>
      <div className="chat-lang">
        <label htmlFor="chat-lang" className="muted">Reply in</label>
        <select id="chat-lang" value={lang} onChange={e => setLang(e.target.value)}>
          {Object.entries(langs).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
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
          <div key={i} className={`bubble ${m.role === "user" ? "u" : "b"} ${m.error ? "err" : ""}`}>
            {m.content}
            {m.sources && m.sources.length > 0 && <><br /><small className="muted">Sources: {m.sources.join(", ")}</small></>}
          </div>
        ))}
        {busy && <div className="bubble b muted">Thinking…</div>}
        <div ref={end} />
      </div>
      <form className="chatform" onSubmit={onSubmit}>
        <input ref={input} required placeholder="Ask TenderSaathi…" value={q} onChange={e => setQ(e.target.value)} />
        <button className="primary" disabled={busy}>Send</button>
      </form>
    </div>
  );
});

export default ChatPanel;
