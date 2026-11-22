"use client";
import { useEffect, useState, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { api, isUnreachable } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { INDIAN_STATES, GSTIN_RE, cache, draft, isProfileComplete, normGstin, pickProfile } from "@/lib/profile";
import { nextStore } from "@/lib/session";
import { remoteProfile } from "@/lib/profile-store";
import ThemeToggle from "@/components/ThemeToggle";
import type { Company, Profile } from "@/lib/types";

type Errors = Partial<Record<keyof Profile, string>>;

export default function Onboarding() {
  const router = useRouter();
  const { me, setMe, logout } = useAuth();
  const [step, setStep] = useState(1);
  const [p, setP] = useState<Profile>(pickProfile(me));
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Already onboarded (back button, bookmark, a second tab)? Don't ask again.
  useEffect(() => { if (isProfileComplete(me)) router.replace(nextStore.take() ?? "/dashboard"); }, [me, router]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setP(prev => ({ ...prev, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  function validate(s: number): Errors {
    const e: Errors = {};
    if (s === 1) {
      if (!p.name.trim()) e.name = "Enter your company name";
      if (!GSTIN_RE.test(normGstin(p.gstin))) e.gstin = "Enter a valid 15-character GSTIN, e.g. 27ABCDE1234F1Z5";
      if (!p.state) e.state = "Choose your state";
    } else if (!p.products.trim() && !p.services.trim()) {
      e.products = "Tell us what you make or the services you provide";
    }
    return e;
  }

  function next() {
    const e = validate(1);
    setErrors(e);
    if (!Object.keys(e).length) setStep(2);
  }

  async function finish() {
    const e = validate(2);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true); setMsg("");
    const payload: Profile = { ...p, name: p.name.trim(), gstin: normGstin(p.gstin) };
    try {
      const c = await api<Company>("/me", { method: "PUT", body: payload });
      draft.clear(me.email);
      cache.set(me.email, c);
      void remoteProfile.save(payload, c.categories);
      setMe(c);
      router.replace(nextStore.take() ?? "/dashboard");
    } catch (err) {
      if (isUnreachable(err)) {           // keep the answers; they sync when the server is back
        draft.set(me.email, payload);
        cache.set(me.email, payload);
        void remoteProfile.save(payload);
        setMe({ ...me, ...payload });
        router.replace(nextStore.take() ?? "/dashboard");
      } else { setMsg((err as Error).message); setBusy(false); }
    }
  }

  const text = (k: "name" | "gstin" | "udyam" | "city" | "certifications", label: string, ph: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="fld">
      <span>{label}</span>
      <input placeholder={ph} value={p[k]} onChange={ev => set(k, ev.target.value)} {...extra} />
      {errors[k] && <em className="err">{errors[k]}</em>}
    </label>
  );

  return (
    <div className="onb">
      <div className="onb-top">
        <b>Tender<span>Saathi</span></b>
        <span className="row"><ThemeToggle /><a href="#" onClick={ev => { ev.preventDefault(); logout(); }}>Log out</a></span>
      </div>
      <div className="card onb-card">
        <p className="muted">Step {step} of 2 · {me.email}</p>
        <div className="bar2"><i style={{ width: step === 1 ? "50%" : "100%" }} /></div>

        {step === 1 ? (
          <>
            <h2>Tell us about your business</h2>
            <p className="muted">We use this to fill tender forms and check your eligibility.</p>
            <div className="grid">
              <div className="full">{text("name", "Company name *", "e.g. Bright Electricals Pvt Ltd")}</div>
              {text("gstin", "GST number (GSTIN) *", "27ABCDE1234F1Z5", { maxLength: 15, style: { textTransform: "uppercase" } })}
              {text("udyam", "Udyam / NSIC number", "UDYAM-XX-00-0000000")}
              <label className="fld">
                <span>State *</span>
                <select value={p.state} onChange={ev => set("state", ev.target.value)}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
                {errors.state && <em className="err">{errors.state}</em>}
              </label>
              {text("city", "City", "e.g. Pune")}
              <label className="fld">
                <span>Enterprise size</span>
                <select value={p.size} onChange={ev => set("size", ev.target.value)}>
                  <option value="micro">Micro</option><option value="small">Small</option>
                  <option value="medium">Medium</option><option value="large">Large</option>
                </select>
              </label>
              <label className="fld">
                <span>Years in business</span>
                <input type="number" min={0} placeholder="0" value={p.years || ""} onChange={ev => set("years", Number(ev.target.value))} />
              </label>
              <label className="fld">
                <span>Annual turnover (₹ crore)</span>
                <input type="number" min={0} step="0.01" placeholder="0" value={p.turnover_cr || ""} onChange={ev => set("turnover_cr", Number(ev.target.value))} />
              </label>
            </div>
            <div className="onb-actions"><span /><button className="primary" onClick={next}>Continue</button></div>
          </>
        ) : (
          <>
            <h2>What do you sell or provide?</h2>
            <p className="muted">We match you to tender categories from this. Fill in at least one.</p>
            <div className="grid">
              <label className="fld full">
                <span>Goods you make or supply</span>
                <textarea rows={3} placeholder="e.g. LED street lights, copper cables, PVC pipes" value={p.products} onChange={ev => set("products", ev.target.value)} />
                {errors.products && <em className="err">{errors.products}</em>}
              </label>
              <label className="fld full">
                <span>Services you provide</span>
                <textarea rows={3} placeholder="e.g. installation, AMC, housekeeping, transport" value={p.services} onChange={ev => set("services", ev.target.value)} />
              </label>
              <div className="full">{text("certifications", "Certifications", "ISO 9001, BIS, NABL…")}</div>
              <label className="chk"><input type="checkbox" checked={p.women_owned} onChange={ev => set("women_owned", ev.target.checked)} /> Women-owned</label>
              <label className="chk"><input type="checkbox" checked={p.startup} onChange={ev => set("startup", ev.target.checked)} /> DPIIT-recognised startup</label>
            </div>
            {msg && <p className="err">{msg}</p>}
            <div className="onb-actions">
              <button onClick={() => setStep(1)} disabled={busy}>Back</button>
              <button className="primary" onClick={finish} disabled={busy}>{busy ? "Saving…" : "Finish and open dashboard"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
