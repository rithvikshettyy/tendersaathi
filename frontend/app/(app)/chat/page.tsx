"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

interface Msg { role: "user" | "assistant"; content: string; sources?: string[]; error?: boolean }

export default function Chat() {
  const [langs, setLangs] = useState<Record<string, string>>({ en: "English" });
  const [lang, setLang] = useState("en");
  const [log, setLog] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { api<Record<string, string>>("/langs").then(setLangs); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question) return;
    const history = log.filter(m => !m.error).map(({ role, content }) => ({ role, content }));
    setLog(l => [...l, { role: "user", content: question }]);
    setQ(""); setBusy(true);
    try {
      const r = await api<{ answer: string; sources: string[] }>("/chat", { body: { question, lang, history } });
      setLog(l => [...l, { role: "assistant", content: r.answer, sources: r.sources }]);
    } catch (err) {
      setLog(l => [...l, { role: "assistant", content: (err as Error).message, error: true }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="bar">
        <h2>Ask TenderSaathi</h2>
        <select style={{ width: "auto" }} value={lang} onChange={e => setLang(e.target.value)}>
          {Object.entries(langs).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="chatlog">
        {log.length === 0 && <p className="muted">Ask about eligibility, your tenders, documents or schemes, in any listed language.</p>}
        {log.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "u" : "b"} ${m.error ? "err" : ""}`}>
            {m.content}
            {m.sources && m.sources.length > 0 && <><br /><small className="muted">Sources: {m.sources.join(", ")}</small></>}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="chatform" onSubmit={send}>
        <input required placeholder="Ask about your tenders, eligibility, schemes…" value={q} onChange={e => setQ(e.target.value)} />
        <button className="primary" disabled={busy}>{busy ? "…" : "Send"}</button>
      </form>
    </div>
  );
}
