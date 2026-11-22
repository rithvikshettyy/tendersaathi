/**
 * Durable copy of the company profile in Supabase (table public.profiles, one row per Google user).
 * The backend keeps working data, but its database can be reset on some hosts, so the profile is
 * mirrored here and restored from here. Row-level security limits each user to their own row.
 * Every call is best-effort: failures return null / do nothing and never break the app.
 */
import { getSupabase, supabaseConfigured } from "./supabase";
import { tokenStore } from "./api";
import { pickProfile } from "./profile";
import type { Profile } from "./types";

const usable = () => tokenStore.isSupabase() && supabaseConfigured;

type Row = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v : "");

function fromRow(r: Row): Profile {
  return pickProfile({
    name: text(r.company_name), gstin: text(r.gstin), udyam: text(r.udyam), state: text(r.state), city: text(r.city),
    size: text(r.size) || "micro", turnover_cr: Number(r.turnover_cr) || 0, years: Number(r.years) || 0,
    certifications: text(r.certifications), products: text(r.products), services: text(r.services),
    women_owned: !!r.women_owned, startup: !!r.startup,
  });
}

export const sameProfile = (a: Profile, b: Profile) => JSON.stringify(pickProfile(a)) === JSON.stringify(pickProfile(b));

export const remoteProfile = {
  /** This user's saved profile, or null (not a Google user, no row yet, or Supabase unreachable). */
  async get(): Promise<Profile | null> {
    if (!usable()) return null;
    try {
      const { data: s } = await getSupabase().auth.getSession();
      if (!s.session) return null;
      const { data, error } = await getSupabase().from("profiles").select("*").eq("id", s.session.user.id).maybeSingle();
      return error || !data ? null : fromRow(data as Row);
    } catch { return null; }
  },

  /** Create or update this user's row. Pass categories when known (the backend assigns them). */
  async save(p: Profile, categories?: string[]): Promise<void> {
    if (!usable()) return;
    try {
      const { data: s } = await getSupabase().auth.getSession();
      if (!s.session) return;
      const u = s.session.user;
      await getSupabase().from("profiles").upsert({
        id: u.id, email: u.email, company_name: p.name, gstin: p.gstin, udyam: p.udyam, state: p.state, city: p.city,
        size: p.size, turnover_cr: p.turnover_cr, years: p.years, certifications: p.certifications,
        products: p.products, services: p.services, women_owned: p.women_owned, startup: p.startup,
        ...(categories ? { categories } : {}),
      }, { onConflict: "id" });
    } catch { /* best effort */ }
  },
};
