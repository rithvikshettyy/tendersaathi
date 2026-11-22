import type { Company, Profile } from "./types";

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const normGstin = (v: string) => v.trim().toUpperCase();

/** What we need before showing the dashboard. */
export function isProfileComplete(c: Pick<Company, "name" | "gstin" | "state" | "products" | "services">) {
  return Boolean(
    c.name?.trim() && GSTIN_RE.test(normGstin(c.gstin || "")) && c.state?.trim() &&
    (c.products?.trim() || c.services?.trim()),
  );
}

export function pickProfile(c: Partial<Profile>): Profile {
  return {
    name: c.name ?? "", gstin: c.gstin ?? "", udyam: c.udyam ?? "", state: c.state ?? "", city: c.city ?? "",
    size: c.size || "micro", turnover_cr: c.turnover_cr ?? 0, years: c.years ?? 0,
    certifications: c.certifications ?? "", products: c.products ?? "", services: c.services ?? "",
    women_owned: !!c.women_owned, startup: !!c.startup,
  };
}

/** Answers saved on this device while the backend is unreachable; synced later. */
const key = (email: string) => `ts_profile_draft:${email.toLowerCase()}`;
export const draft = {
  get(email: string): Profile | null {
    try { const v = localStorage.getItem(key(email)); return v ? pickProfile(JSON.parse(v)) : null; } catch { return null; }
  },
  set(email: string, p: Profile) { try { localStorage.setItem(key(email), JSON.stringify(p)); } catch { /* storage blocked */ } },
  clear(email: string) { try { localStorage.removeItem(key(email)); } catch { /* storage blocked */ } },
};

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
