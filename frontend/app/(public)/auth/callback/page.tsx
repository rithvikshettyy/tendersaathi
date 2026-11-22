"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { api, tokenStore } from "@/lib/api";
import type { Company } from "@/lib/types";

export default function AuthCallback() {
  const router = useRouter();
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthErr = params.get("error_description") || params.get("error");
      if (oauthErr) { setErr(oauthErr); return; }
      const code = params.get("code");
      if (!code) { setErr("Missing sign-in code. Please try again."); return; }

      let result;
      try { result = await getSupabase().auth.exchangeCodeForSession(code); }
      catch (e) { setErr((e as Error).message); return; }
      const { data, error } = result;
      if (error || !data.session) { setErr(error?.message || "Sign-in failed."); return; }
      tokenStore.setSupabase(data.session.access_token);

      try {
        const me = await api<Company>("/me"); // backend creates the company on first Google login
        router.replace(me.products || me.services ? "/dashboard" : "/profile?welcome=1");
      } catch (e) { setErr((e as Error).message || "Something went wrong after sign-in."); }
    })();
  }, [router]);

  return (
    <div className="auth">
      <div className="card">
        {err ? (<><h2>Sign-in problem</h2><p className="err">{err}</p><p><a href="/login">Back to log in</a></p></>)
             : <p className="muted">Signing you in…</p>}
      </div>
    </div>
  );
}
