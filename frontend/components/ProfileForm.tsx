"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Profile } from "@/lib/types";

export const emptyProfile: Profile = {
  name: "", gstin: "", udyam: "", state: "", city: "", size: "micro", turnover_cr: 0, years: 0,
  certifications: "", products: "", services: "", women_owned: false, startup: false,
};

/** A field with a visible label (placeholders disappear once filled, which left phone users guessing). */
function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label className={`fld ${full ? "full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function ProfileForm({ initial, submitLabel, onSubmit, children }: {
  initial?: Partial<Profile>;
  submitLabel: string;
  onSubmit: (p: Profile) => Promise<void> | void;
  children?: ReactNode;
}) {
  const [p, setP] = useState<Profile>({ ...emptyProfile, ...initial });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP(prev => ({ ...prev, [k]: v }));
  const text = (k: "gstin" | "udyam" | "state" | "city" | "certifications", label: string, ph: string, full?: boolean) => (
    <Field label={label} full={full}>
      <input placeholder={ph} value={p[k]} onChange={e => set(k, e.target.value)} />
    </Field>
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await onSubmit(p); } finally { setBusy(false); }
  }

  return (
    <form className="grid" onSubmit={submit}>
      {children}
      <Field label="Company name" full>
        <input required placeholder="e.g. Bright Electricals Pvt Ltd" value={p.name} onChange={e => set("name", e.target.value)} />
      </Field>
      {text("gstin", "GST number (GSTIN)", "27ABCDE1234F1Z5")}
      {text("udyam", "Udyam / NSIC number", "UDYAM-XX-00-0000000")}
      {text("state", "State", "e.g. Maharashtra")}
      {text("city", "City", "e.g. Pune")}
      <Field label="Enterprise size">
        <select value={p.size} onChange={e => set("size", e.target.value)}>
          <option value="micro">Micro enterprise</option>
          <option value="small">Small enterprise</option>
          <option value="medium">Medium enterprise</option>
          <option value="large">Large</option>
        </select>
      </Field>
      <Field label="Annual turnover (₹ crore)">
        <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" value={p.turnover_cr || ""} onChange={e => set("turnover_cr", Number(e.target.value))} />
      </Field>
      <Field label="Years in business">
        <input type="number" inputMode="numeric" min="0" placeholder="0" value={p.years || ""} onChange={e => set("years", Number(e.target.value))} />
      </Field>
      {text("certifications", "Certifications", "ISO 9001, BIS, NABL…")}
      <Field label="Goods you make or supply" full>
        <textarea rows={3} placeholder="e.g. LED lights, copper cables" value={p.products} onChange={e => set("products", e.target.value)} />
      </Field>
      <Field label="Services you provide" full>
        <textarea rows={3} placeholder="e.g. installation, AMC, transport" value={p.services} onChange={e => set("services", e.target.value)} />
      </Field>
      <label className="chk"><input type="checkbox" checked={p.women_owned} onChange={e => set("women_owned", e.target.checked)} /> Women-owned</label>
      <label className="chk"><input type="checkbox" checked={p.startup} onChange={e => set("startup", e.target.checked)} /> DPIIT-recognised startup</label>
      <button className="primary full" disabled={busy}>{busy ? "Please wait…" : submitLabel}</button>
    </form>
  );
}
