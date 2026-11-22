import { supabase } from "./supabase";

const PROVIDER_KEY = "ts_provider";

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem("ts_token")),
  /** Email/password session token from our own backend. */
  set: (t: string) => { localStorage.setItem("ts_token", t); localStorage.removeItem(PROVIDER_KEY); },
  /** Google (Supabase) login. The access token is refreshed on demand, see freshToken(). */
  setSupabase: (t: string) => { localStorage.setItem("ts_token", t); localStorage.setItem(PROVIDER_KEY, "supabase"); },
  clear: () => { localStorage.removeItem("ts_token"); localStorage.removeItem(PROVIDER_KEY); },
  isSupabase: () => typeof window !== "undefined" && localStorage.getItem(PROVIDER_KEY) === "supabase",
};

export async function signOutEverywhere() {
  if (tokenStore.isSupabase()) await supabase.auth.signOut().catch(() => {});
  tokenStore.clear();
}

/** Supabase access tokens expire hourly; getSession() refreshes them transparently. */
async function freshToken(): Promise<string | null> {
  if (tokenStore.isSupabase()) {
    const { data } = await supabase.auth.getSession();
    if (data.session) { localStorage.setItem("ts_token", data.session.access_token); return data.session.access_token; }
    return null;
  }
  return tokenStore.get();
}

interface Opts { method?: string; body?: unknown; form?: FormData }

export async function api<T>(path: string, { method, body, form }: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = await freshToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api${path}`, {
    method: method ?? (body !== undefined || form ? "POST" : "GET"),
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || res.statusText);
  return data as T;
}
