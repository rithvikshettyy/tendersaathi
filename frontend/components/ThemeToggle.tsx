"use client";
import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("ts_theme", t); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event("ts:theme"));
}

/** Current theme, kept in sync with the toggle (and with the OS until the user picks one). */
export function useTheme(): Theme {
  const [t, setT] = useState<Theme>("dark");
  useEffect(() => {
    const sync = () => setT(current());
    sync();
    window.addEventListener("ts:theme", sync);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onOs = () => {
      let chosen: string | null = null;
      try { chosen = localStorage.getItem("ts_theme"); } catch { /* storage blocked */ }
      if (!chosen) { document.documentElement.dataset.theme = mq.matches ? "dark" : "light"; sync(); }
    };
    mq.addEventListener("change", onOs);
    return () => { window.removeEventListener("ts:theme", sync); mq.removeEventListener("change", onOs); };
  }, []);
  return t;
}

export default function ThemeToggle({ className = "theme-toggle" }: { className?: string }) {
  const theme = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className={className} onClick={() => applyTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  );
}
