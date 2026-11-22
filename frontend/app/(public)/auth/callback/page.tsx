"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { tokenStore } from "@/lib/api";
import { nextStore } from "@/lib/session";

export default function AuthCallback() {
  const router = useRouter();
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthErr = params.get("error_description") || params.get("error");
      if (oauthErr) { setErr(oauthErr); return; }
      const code = params.get("code");
      if (!code) {
        // Refreshed or bookmarked callback: if we are already signed in, just carry on.
        if (tokenStore.get()) { router.replace("/dashboard"); return; }
        setErr("Missing sign-in code. Please try again.");
        return;
      }

      let result;
      try { result = await getSupabase().auth.exchangeCodeForSession(code); }
      catch (e) { setErr((e as Error).message); return; }
      const { data, error } = result;
      if (error || !data.session) {
        // A code can only be used once (e.g. the page was reloaded). A live session means we are fine.
        if (tokenStore.get()) { router.replace("/dashboard"); return; }
        setErr(error?.message || "Sign-in failed.");
        return;
      }
      tokenStore.setSupabase(data.session.access_token);

      // The dashboard gate sends new users to /onboarding, then on to wherever they were heading.
      router.replace(nextStore.take() ?? "/dashboard");
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
