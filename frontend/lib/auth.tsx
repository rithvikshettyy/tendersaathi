"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, signOutEverywhere, tokenStore } from "./api";
import type { Company } from "./types";

interface Ctx { me: Company; setMe: (c: Company) => void; logout: () => void }
const AuthCtx = createContext<Ctx | null>(null);

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
};

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Company | null>(null);

  useEffect(() => {
    if (!tokenStore.get()) { router.replace("/login"); return; }
    api<Company>("/me").then(setMe).catch(() => { tokenStore.clear(); router.replace("/login"); });
  }, [router]);

  if (!me) return <p className="muted pad">Loading…</p>;
  const logout = () => { signOutEverywhere().finally(() => router.replace("/login")); };
  return <AuthCtx.Provider value={{ me, setMe, logout }}>{children}</AuthCtx.Provider>;
}
