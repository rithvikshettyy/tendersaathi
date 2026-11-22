"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, tokenStore } from "@/lib/api";
import ProfileForm from "@/components/ProfileForm";
import type { Profile } from "@/lib/types";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
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

  return (
    <>
      <div className="auth">
        <div className="card">
          <h2>{signup ? "Register your company" : "Welcome back"}</h2>
          {signup ? (
            <ProfileForm submitLabel="Create account" onSubmit={(p: Profile) => go("/register", { ...p, email, password })}>
              {creds}
            </ProfileForm>
          ) : (
            <form className="grid" onSubmit={(e: FormEvent) => { e.preventDefault(); go("/login", { email, password }); }}>
              {creds}
              <button className="primary full">Log in</button>
            </form>
          )}
          {err && <p className="err">{err}</p>}
          <p className="muted">
            {signup ? "Already registered? " : "New here? "}
            <Link href={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Sign up"}</Link>
          </p>
        </div>
      </div>
    </>
  );
}
