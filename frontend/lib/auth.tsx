"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, isUnreachable, signOutEverywhere, tokenStore } from "./api";
import { getSupabase, supabaseConfigured } from "./supabase";
import { cache, draft, isProfileComplete, pickProfile } from "./profile";
import { remoteProfile, sameProfile } from "./profile-store";
import { cloud } from "./cloud";
import { loginUrl, nextStore } from "./session";
import { setProfile as setDemoProfile } from "./demo";
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
 *
 * Resilience:
 * - A temporary backend outage never logs you out. Google users get in with a banner; others see a retry screen.
 * - Only a genuine 401 signs you out, with a "session expired" message and a return-to-page link.
 * - Answers saved on this device while offline are synced when the backend answers again.
 * - If the backend has forgotten the account (e.g. its database was reset), the last good profile
 *   kept on this device is restored, so returning users are not sent through onboarding again.
 */
export function AuthGate({ children, requireProfile = false }: { children: ReactNode; requireProfile?: boolean }) {
  const router = useRouter();
  const [me, setMe] = useState<Company | null>(null);
  const [offline, setOffline] = useState(false);
  const [fatal, setFatal] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!tokenStore.get()) { router.replace(loginUrl()); return; }
    let cancelled = false;
    (async () => {
      let company: Company | null = null;
      let isOffline = false;
      try {
        company = await api<Company>("/me");
      } catch (e) {
        if (isUnreachable(e)) {
          company = await profileFromSupabase();
          if (company) isOffline = true;
          else { if (!cancelled) setFatal("We can't reach the TenderSaathi server right now."); return; }
        } else {
          const expired = e instanceof ApiError && e.status === 401;
          await signOutEverywhere();
          if (!cancelled) router.replace(loginUrl(expired ? "expired" : undefined));
          return;
        }
      }

      const email = company.email;
      const pending = draft.get(email);          // changes made while offline, not yet on the server
      const known = cache.get(email);            // last good copy, kept on this device
      const remote = await remoteProfile.get();  // durable copy in Supabase (Google users); null otherwise
      if (isOffline) {
        const local = pending ?? remote ?? known;
        if (local) company = { ...company, ...local };
      } else {
        if (pending) {
          try { company = await api<Company>("/me", { method: "PUT", body: pending }); draft.clear(email); }
          catch { company = { ...company, ...pending }; }
        } else if (!isProfileComplete(company)) {
          // The backend has no usable profile (new account, or its database was reset): restore it from
          // Supabase, else from this device. This also seeds the backend for users who already have a row.
          const restore = [remote, known].find(x => x && isProfileComplete(x));
          if (restore) {
            try { company = await api<Company>("/me", { method: "PUT", body: restore }); }
            catch { company = { ...company, ...restore }; }
          }
        }
        if (isProfileComplete(company)) {
          cache.set(email, company);
          if (!remote || !sameProfile(remote, company)) void remoteProfile.save(pickProfile(company), company.categories);
        }
      }

      if (cancelled) return;
      if (requireProfile && !isProfileComplete(company)) {
        nextStore.set(window.location.pathname + window.location.search);
        router.replace("/onboarding");
        return;
      }
      try {
        if (!sessionStorage.getItem("ts_login_logged")) {
          sessionStorage.setItem("ts_login_logged", "1");
          void cloud.track("login", { offline: isOffline });
        }
      } catch { /* storage blocked */ }
      setMe(company); setOffline(isOffline); setFatal("");
    })();
    return () => { cancelled = true; };
  }, [router, requireProfile, attempt]);

  const logout = useCallback(() => { signOutEverywhere().finally(() => router.replace("/login")); }, [router]);

  if (fatal) {
    return (
      <div className="auth"><div className="card">
        <h2>Can&apos;t connect</h2>
        <p className="muted">{fatal} You&apos;re still signed in. This is usually temporary (the server may be waking up).</p>
        <div className="row">
          <button className="primary" onClick={() => { setFatal(""); setAttempt(a => a + 1); }}>Try again</button>
          <button onClick={logout}>Log out</button>
        </div>
      </div></div>
    );
  }
  if (!me) return <p className="muted pad">Loading…</p>;
  setDemoProfile(me);   // sample data is generated for this profile; set before children fetch
  return <AuthCtx.Provider value={{ me, setMe, logout, offline }}>{children}</AuthCtx.Provider>;
}
