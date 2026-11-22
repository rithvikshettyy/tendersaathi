import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

/** Created on first use, so a missing env var never breaks the build or email/password login. */
export function getSupabase(): SupabaseClient {
  if (!URL || !KEY) {
    throw new Error("Google sign-in is not configured (missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).");
  }
  client ??= createClient(URL, KEY, { auth: { flowType: "pkce", detectSessionInUrl: false } });
  return client;
}

export async function signInWithGoogle() {
  if (!supabaseConfigured) {
    return { data: null, error: new Error("Google sign-in is not configured on this deployment yet.") };
  }
  return getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}
