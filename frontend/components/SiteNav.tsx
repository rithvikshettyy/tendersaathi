"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { tokenStore } from "@/lib/api";

export default function SiteNav() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => { setAuthed(!!tokenStore.get()); }, []);
  return (
    <nav className="topnav">
      <Link href="/" className="brand">Tender<span>Saathi</span></Link>
      <div className="links">
        <Link href="/#features">Features</Link>
        <Link href="/#how">How it works</Link>
        {authed ? (
          <Link href="/dashboard"><button className="primary">Go to dashboard</button></Link>
        ) : (
          <>
            <Link href="/login"><button>Log in</button></Link>
            <Link href="/signup"><button className="primary">Sign up</button></Link>
          </>
        )}
      </div>
    </nav>
  );
}
