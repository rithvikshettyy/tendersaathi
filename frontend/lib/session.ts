/** Where to send the user after login: the page they originally asked for. */
const KEY = "ts_next";

/** Only same-site, in-app paths. Never an absolute URL (open-redirect) or an auth page (loop). */
export function safeNext(n: string | null | undefined): string | null {
  if (!n || !n.startsWith("/") || n.startsWith("//") || n.includes("\\")) return null;
  if (/^\/(login|signup|auth|onboarding)(\/|\?|$)/.test(n)) return null;
  return n;
}

export const nextStore = {
  /** Remember a destination across the Google redirect. */
  set(path: string | null) {
    const p = safeNext(path);
    try { if (p) sessionStorage.setItem(KEY, p); } catch { /* storage blocked */ }
  },
  /** Read and clear it. */
  take(): string | null {
    try { const v = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); return safeNext(v); } catch { return null; }
  },
};

/** `?next=` from the current URL, validated. */
export const nextFromUrl = () =>
  typeof window === "undefined" ? null : safeNext(new URLSearchParams(window.location.search).get("next"));

export const loginUrl = (reason?: "expired") => {
  const here = typeof window === "undefined" ? "" : window.location.pathname + window.location.search;
  const next = safeNext(here);
  const qs = new URLSearchParams();
  if (next) qs.set("next", next);
  if (reason) qs.set("reason", reason);
  const s = qs.toString();
  return s ? `/login?${s}` : "/login";
};
