"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, signOutEverywhere, tokenStore } from "./api";
import { getSupabase, supabaseConfigured } from "./supabase";
import type { Company } from "./types";

interface Ctx { me: Company; setMe: (c: Company) => void; logout: () => void; offline: boolean }
const AuthCtx = createContext<Ctx | null>(null);

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
};

/** Backend down/unreachable (as opposed to "your login is invalid"). */
const isUnreachable = (e: unknown) =>
  !(e instanceof ApiError) || [404, 500, 502, 503, 504].includes(e.status);

/** Minimal profile built from the Supabase user, used while the backend is unreachable. */
async function profileFromSupabase(): Promise<Company | null> {
  if (!tokenStore.isSupabase() || !supabaseConfigured) return null;
  const { data } = await getSupabase().auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, string>;
  return {
    id: 0, email: u.email ?? "", name: meta.full_name || meta.name || u.email || "You",
    gstin: "", udyam: "", state: "", city: "", size: "micro", turnover_cr: 0, years: 0,
    certifications: "", products: "", services: "", women_owned: false, startup: false, categories: [],
  };
}

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Company | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!tokenStore.get()) { router.replace("/login"); return; }
    (async () => {
      try {
        setMe(await api<Company>("/me"));
      } catch (e) {
        const fallback = isUnreachable(e) ? await profileFromSupabase() : null;
        if (fallback) { setMe(fallback); setOffline(true); return; }
        await signOutEverywhere();
        router.replace("/login");
      }
    })();
  }, [router]);

  if (!me) return <p className="muted pad">Loading…</p>;
  const logout = () => { signOutEverywhere().finally(() => router.replace("/login")); };
  return <AuthCtx.Provider value={{ me, setMe, logout, offline }}>{children}</AuthCtx.Provider>;
}
