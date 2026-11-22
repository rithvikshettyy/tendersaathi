"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Scheme } from "@/lib/types";

export default function Schemes() {
  const [s, setS] = useState<Scheme[]>([]);
  useEffect(() => { api<Scheme[]>("/schemes").then(setS); }, []);
  return (
    <>
      <h2>Government schemes & benefits</h2>
      {s.map(x => (
        <div className={`card ${x.applicable ? "" : "na"}`} key={x.name}>
          <b>{x.name}</b> <span className={`pill ${x.applicable ? "green" : ""}`}>{x.applicable ? "likely applies" : "check eligibility"}</span>
          <p>{x.desc}</p>
          <a href={x.url} target="_blank" rel="noopener noreferrer">Official site ↗</a>
        </div>
      ))}
      <p className="muted">Summaries are general. Limits and eligibility change; confirm on the official portal.</p>
    </>
  );
}
