"use client";
/**
 * Voice input with a live transcript.
 * - Browsers with built-in speech recognition (Chrome, Edge, Safari): words appear as you speak.
 * - Others (e.g. Firefox): the mic records and Sarvam (saaras:v4 via /api/stt) re-transcribes the clip
 *   every few seconds, so the text still updates while you talk. Max 30 s per recording.
 * Nothing is sent to the chat automatically: the caller shows the text for the user to check and send.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

const BCP47: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", bn: "bn-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN",
  ml: "ml-IN", mr: "mr-IN", gu: "gu-IN", pa: "pa-IN", od: "or-IN",
};
const MAX_MS = 30_000, CHUNK_MS = 1_000, RETRANSCRIBE_MS = 3_500;

/* Minimal typing for the Web Speech API (not in TS's DOM lib everywhere). */
interface SRResult { isFinal: boolean; 0: { transcript: string } }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SR {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SREvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SRCtor = new () => SR;
const srCtor = (): SRCtor | null =>
  typeof window === "undefined" ? null :
    ((window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }).SpeechRecognition ??
     (window as unknown as { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition ?? null);

export type VoiceMode = "live" | "sarvam" | "none";

export function voiceMode(): VoiceMode {
  if (srCtor()) return "live";
  if (typeof window !== "undefined" && "MediaRecorder" in window && typeof navigator.mediaDevices?.getUserMedia === "function") return "sarvam";
  return "none";
}

const MIC_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone permission was denied. Allow it in the browser's address bar and try again.",
  "service-not-allowed": "Microphone permission was denied. Allow it in the browser's address bar and try again.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs an internet connection.",
  "language-not-supported": "This browser can't recognise speech in the selected language. Try English or another browser.",
};

async function sarvamTranscribe(blob: Blob, lang: string): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "speech.webm");
  // api() adds (and refreshes) the login token and shows the backend's error message.
  const r = await api<{ text: string }>(`/stt?lang=${encodeURIComponent(lang)}`, { form });
  return r.text || "";
}

/**
 * onText(text, final): called with the full transcript so far. `final` is false while words may still change.
 */
export function useVoiceInput(lang: string, onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<VoiceMode>("none");
  useEffect(() => { setMode(voiceMode()); }, []);   // browser-only check, after hydration
  const stopRef = useRef<() => void>(() => {});
  const cb = useRef(onText);
  cb.current = onText;

  const startLive = useCallback(() => {
    const Ctor = srCtor()!;
    const rec = new Ctor();
    rec.lang = BCP47[lang] ?? "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      cb.current((finalText + interim).replace(/\s+/g, " ").trim(), !interim);
    };
    rec.onerror = e => { if (e.error !== "no-speech" && e.error !== "aborted") setError(MIC_ERRORS[e.error] ?? `Voice input error: ${e.error}`); };
    rec.onend = () => { setListening(false); cb.current(finalText.replace(/\s+/g, " ").trim(), true); };
    stopRef.current = () => rec.stop();
    rec.start();
    setListening(true);
  }, [lang]);

  const startSarvam = useCallback(async () => {
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError(MIC_ERRORS["not-allowed"]); return; }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    let busy = false, done = false, last = "";
    const blob = () => new Blob(chunks, { type: rec.mimeType || "audio/webm" });
    const run = async (final: boolean) => {
      if (busy && !final) return;
      busy = true;
      try {
        if (chunks.length) { last = await sarvamTranscribe(blob(), lang); cb.current(last, final); }
        else if (final) cb.current(last, true);
      } catch (e) { setError((e as Error).message); }
      finally { busy = false; }
    };
    const tick = setInterval(() => { if (!done) run(false); }, RETRANSCRIBE_MS);
    const cap = setTimeout(() => stop(), MAX_MS);
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      done = true;
      clearInterval(tick); clearTimeout(cap);
      stream.getTracks().forEach(t => t.stop());
      cb.current(last, false);
      await run(true);
      setListening(false);
    };
    function stop() { if (rec.state !== "inactive") rec.stop(); }
    stopRef.current = stop;
    rec.start(CHUNK_MS);
    setListening(true);
  }, [lang]);

  const start = useCallback(() => {
    setError("");
    if (mode === "live") startLive();
    else if (mode === "sarvam") startSarvam();
    else setError("Voice input isn't supported in this browser.");
  }, [mode, startLive, startSarvam]);

  const stop = useCallback(() => stopRef.current(), []);
  useEffect(() => () => stopRef.current(), []);   // release the mic when the chat unmounts
  return { listening, error, mode, start, stop, toggle: () => (listening ? stop() : start()) };
}
