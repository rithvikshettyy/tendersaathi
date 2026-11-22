"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import ProfileForm from "@/components/ProfileForm";
import type { Company, Profile } from "@/lib/types";

export default function ProfilePage() {
  const { me, setMe } = useAuth();
  const [msg, setMsg] = useState("");

  async function save(p: Profile) {
    try {
      const c = await api<Company>("/me", { method: "PUT", body: p });
      setMe(c);
      setMsg("Saved. Categories: " + c.categories.join(", "));
    } catch (e) { setMsg((e as Error).message); }
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
