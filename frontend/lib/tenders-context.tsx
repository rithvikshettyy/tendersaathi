"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Tender } from "./types";

interface Ctx { tenders: Tender[]; loaded: boolean; refresh: () => Promise<void> }
const TendersCtx = createContext<Ctx | null>(null);

export const useTenders = () => {
  const c = useContext(TendersCtx);
  if (!c) throw new Error("useTenders outside provider");
  return c;
};

/** Loads the tender list once for the whole app shell (topbar bell + dashboard). Fails soft. */
export function TendersProvider({ children }: { children: ReactNode }) {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try { setTenders(await api<Tender[]>("/tenders")); } catch { /* backend unreachable: keep what we have */ }
    setLoaded(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return <TendersCtx.Provider value={{ tenders, loaded, refresh }}>{children}</TendersCtx.Provider>;
}
