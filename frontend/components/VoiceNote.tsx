"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiBlob } from "@/lib/api";

type Status = "idle" | "loading" | "playing" | "paused" | "error";

let current: HTMLAudioElement | null = null; // one voice note plays at a time, like WhatsApp

const fmt = (s: number) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/** WhatsApp-style voice note for a chat reply: play/pause, progress bar (click to seek), duration. */
export default function VoiceNote({ text, lang, autoPlay = false }: { text: string; lang: string; autoPlay?: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const started = useRef(false);

  const attach = useCallback((a: HTMLAudioElement) => {
    a.onloadedmetadata = () => setDuration(a.duration);
    a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    a.onplay = () => setStatus("playing");
    a.onpause = () => { if (!a.ended) setStatus("paused"); };
    a.onended = () => { setStatus("idle"); setProgress(0); };
  }, []);

  const toggle = useCallback(async () => {
    const a = audio.current;
    if (a) {                                              // already loaded: play/pause
      if (a.paused) { if (current && current !== a) current.pause(); current = a; a.play().catch(() => setStatus("paused")); }
      else a.pause();
      return;
    }
    setStatus("loading"); setError("");
    try {
      const blob = await apiBlob("/tts", { text, lang });
      url.current = URL.createObjectURL(blob);
      const el = new Audio(url.current);
      audio.current = el;
      attach(el);
      if (current) current.pause();
      current = el;
      await el.play();
    } catch (e) {
      const msg = (e as Error).message;
      if ((e as Error).name === "NotAllowedError") setStatus("paused");   // browser blocked autoplay: tap to play
      else { setStatus("error"); setError(msg || "Voice is unavailable right now."); }
    }
  }, [text, lang, attach]);

  useEffect(() => { if (autoPlay && !started.current) { started.current = true; toggle(); } }, [autoPlay, toggle]);
  useEffect(() => () => {
    audio.current?.pause();
    if (current === audio.current) current = null;
    if (url.current) URL.revokeObjectURL(url.current);
  }, []);

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audio.current;
    if (!a || !a.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * a.duration;
  }

  if (status === "error") {
    return <div className="vnote err"><button type="button" className="vplay" onClick={() => { setStatus("idle"); toggle(); }} aria-label="Retry voice">↻</button><span>{error}</span></div>;
  }

  return (
    <div className="vnote">
      <button type="button" className="vplay" onClick={toggle} aria-label={status === "playing" ? "Pause voice reply" : "Play voice reply"} disabled={status === "loading"}>
        {status === "loading" ? <span className="spin" /> : status === "playing" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>
        )}
      </button>
      <div className="vbar" onClick={seek} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="vtime">{status === "idle" || status === "loading" ? (duration ? fmt(duration) : "Listen") : fmt(duration * (1 - progress))}</span>
    </div>
  );
}
