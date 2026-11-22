"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, tokenStore } from "@/lib/api";
import { signInWithGoogle } from "@/lib/supabase";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      // Signup collects only credentials. Business details come next, on the onboarding form.
      const body = signup ? { email, password, name: email.split("@")[0] } : { email, password };
      const r = await api<{ token: string }>(signup ? "/register" : "/login", { body });
      tokenStore.set(r.token);
      router.replace(signup ? "/onboarding" : "/dashboard");
    } catch (e) {
      setErr((e as Error).message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="card">
        <h2>{signup ? "Create your account" : "Welcome back"}</h2>
        <button type="button" className="google" onClick={async () => {
          const { error } = await signInWithGoogle();
          if (error) setErr(error.message);
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
          Continue with Google
        </button>
        <p className="or"><span>or use email</span></p>
        <form className="grid" onSubmit={submit}>
          <input className="full" type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="full" type="password" required minLength={6} placeholder="Password (min 6)" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="primary full" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Log in"}</button>
        </form>
        {err && <p className="err">{err}</p>}
        <p className="muted">
          {signup ? "Already registered? " : "New here? "}
          <Link href={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Sign up"}</Link>
        </p>
      </div>
    </div>
  );
}
