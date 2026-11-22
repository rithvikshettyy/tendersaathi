"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, tokenStore } from "@/lib/api";
import ProfileForm from "@/components/ProfileForm";
import type { Profile } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [registering, setRegistering] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function go(path: string, body: unknown) {
    setErr("");
    try {
      const r = await api<{ token: string }>(path, { body });
      tokenStore.set(r.token);
      router.replace("/dashboard");
    } catch (e) { setErr((e as Error).message); }
  }

  const creds = (
    <>
      <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" required minLength={6} placeholder="Password (min 6)" value={password} onChange={e => setPassword(e.target.value)} />
    </>
  );

  async function login(e: FormEvent) {
    e.preventDefault();
    await go("/login", { email, password });
  }

  return (
    <div className="auth">
      <div className="card">
        <h2>Tender<span style={{ color: "var(--acc)" }}>Saathi</span> · {registering ? "Register your company" : "Log in"}</h2>
        {registering ? (
          <ProfileForm submitLabel="Create account" onSubmit={(p: Profile) => go("/register", { ...p, email, password })}>
            {creds}
          </ProfileForm>
        ) : (
          <form className="grid" onSubmit={login}>{creds}<button className="primary full">Log in</button></form>
        )}
        {err && <p className="err">{err}</p>}
        <p><a href="#" onClick={e => { e.preventDefault(); setRegistering(!registering); setErr(""); }}>
          {registering ? "Already registered? Log in" : "New here? Register"}
        </a></p>
      </div>
    </div>
  );
}
