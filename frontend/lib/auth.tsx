"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, isUnreachable, signOutEverywhere, tokenStore } from "./api";
import { getSupabase, supabaseConfigured } from "./supabase";
import { draft, isProfileComplete, pickProfile } from "./profile";
import type { Company } from "./types";

interface Ctx { me: Company; setMe: (c: Company) => void; logout: () => void; offline: boolean }
const AuthCtx = createContext<Ctx | null>(null);

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
};

/** Minimal profile built from the Supabase user, used while the backend is unreachable. */
async function profileFromSupabase(): Promise<Company | null> {
  if (!tokenStore.isSupabase() || !supabaseConfigured) return null;
  const { data } = await getSupabase().auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, string>;
  return { ...pickProfile({ name: meta.full_name || meta.name || u.email || "You" }), id: 0, email: u.email ?? "", categories: [] };
}

/**
 * Requires a login. With requireProfile, also sends users with an incomplete profile to /onboarding.
 * If the backend is unreachable, a real Supabase session still gets in (offline mode), and any
 * onboarding answers saved on this device are used and synced once the backend is back.
 */
export function AuthGate({ children, requireProfile = false }: { children: ReactNode; requireProfile?: boolean }) {
  const router = useRouter();
  const [me, setMe] = useState<Company | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!tokenStore.get()) { router.replace("/login"); return; }
    (async () => {
      let company: Company | null = null;
      let isOffline = false;
      try {
        company = await api<Company>("/me");
        const saved = draft.get(company.email);
        if (saved && !isProfileComplete(company)) {            // sync answers saved while offline
          try { company = await api<Company>("/me", { method: "PUT", body: saved }); draft.clear(company.email); }
          catch { company = { ...company, ...saved }; }
        }
      } catch (e) {
        company = isUnreachable(e) ? await profileFromSupabase() : null;
        if (!company) { await signOutEverywhere(); router.replace("/login"); return; }
        const saved = draft.get(company.email);
        if (saved) company = { ...company, ...saved };
        isOffline = true;
      }
      if (requireProfile && !isProfileComplete(company)) { router.replace("/onboarding"); return; }
      setMe(company); setOffline(isOffline);
    })();
  }, [router, requireProfile]);

  if (!me) return <p className="muted pad">Loading…</p>;
  const logout = () => { signOutEverywhere().finally(() => router.replace("/login")); };
  return <AuthCtx.Provider value={{ me, setMe, logout, offline }}>{children}</AuthCtx.Provider>;
}
