"use client";
import { useState } from "react";
import { api, isUnreachable } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import ProfileForm from "@/components/ProfileForm";
import { cache, draft } from "@/lib/profile";
import type { Company, Profile } from "@/lib/types";

export default function ProfilePage() {
  const { me, setMe } = useAuth();
  const [msg, setMsg] = useState("");

  async function save(p: Profile) {
    try {
      const c = await api<Company>("/me", { method: "PUT", body: p });
      draft.clear(me.email);
      cache.set(me.email, c);
      setMe(c);
      setMsg("Saved. Categories: " + c.categories.join(", "));
    } catch (e) {
      if (isUnreachable(e)) {             // keep the edit on this device; it syncs when the server is back
        draft.set(me.email, p);
        cache.set(me.email, p);
        setMe({ ...me, ...p });
        setMsg("Saved on this device. It will sync when the server is reachable again.");
      } else setMsg((e as Error).message);
    }
  }

  return (
    <div className="card">
      <h2>Company profile</h2>
      {!me.products && !me.services && (
        <p className="muted">Welcome! Tell us what you make or provide so we can set your tender categories.</p>
      )}
      <ProfileForm initial={me} submitLabel="Save profile" onSubmit={save} />
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
