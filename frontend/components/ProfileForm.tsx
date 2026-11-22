"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Profile } from "@/lib/types";

export const emptyProfile: Profile = {
  name: "", gstin: "", udyam: "", state: "", city: "", size: "micro", turnover_cr: 0, years: 0,
  certifications: "", products: "", services: "", women_owned: false, startup: false,
};

export default function ProfileForm({ initial, submitLabel, onSubmit, children }: {
  initial?: Partial<Profile>;
  submitLabel: string;
  onSubmit: (p: Profile) => Promise<void> | void;
  children?: ReactNode;
}) {
  const [p, setP] = useState<Profile>({ ...emptyProfile, ...initial });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP(prev => ({ ...prev, [k]: v }));
  const text = (k: "gstin" | "udyam" | "state" | "city" | "certifications", ph: string) => (
    <input placeholder={ph} value={p[k]} onChange={e => set(k, e.target.value)} />
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await onSubmit(p); } finally { setBusy(false); }
  }

  return (
    <form className="grid" onSubmit={submit}>
      {children}
      <input className="full" required placeholder="Company name" value={p.name} onChange={e => set("name", e.target.value)} />
      {text("gstin", "GSTIN")}
      {text("udyam", "Udyam / NSIC number")}
      {text("state", "State")}
      {text("city", "City")}
      <select value={p.size} onChange={e => set("size", e.target.value)}>
        <option value="micro">Micro enterprise</option>
        <option value="small">Small enterprise</option>
        <option value="medium">Medium enterprise</option>
        <option value="large">Large</option>
      </select>
      <input type="number" step="0.01" min="0" placeholder="Annual turnover (₹ Crore)" value={p.turnover_cr || ""} onChange={e => set("turnover_cr", Number(e.target.value))} />
      <input type="number" min="0" placeholder="Years in business" value={p.years || ""} onChange={e => set("years", Number(e.target.value))} />
      {text("certifications", "Certifications (ISO 9001, BIS, NABL…)")}
      <textarea className="full" rows={2} placeholder="What do you manufacture / produce? (e.g. LED lights, copper cables)" value={p.products} onChange={e => set("products", e.target.value)} />
      <textarea className="full" rows={2} placeholder="Services / facilities you provide (e.g. installation, AMC, transport)" value={p.services} onChange={e => set("services", e.target.value)} />
      <label className="chk"><input type="checkbox" checked={p.women_owned} onChange={e => set("women_owned", e.target.checked)} /> Women-owned</label>
      <label className="chk"><input type="checkbox" checked={p.startup} onChange={e => set("startup", e.target.checked)} /> DPIIT-recognised startup</label>
      <button className="primary full" disabled={busy}>{busy ? "Please wait…" : submitLabel}</button>
    </form>
  );
}
