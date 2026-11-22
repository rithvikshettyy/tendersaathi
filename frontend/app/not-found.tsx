import type { Metadata } from "next";
import Link from "next/link";
import PublicLayout from "./(public)/layout";

export const metadata: Metadata = { title: "Page not found · TenderSaathi" };

/** Shown for any unknown URL. Reuses the public site's nav, theme, language switch and footer. */
export default function NotFound() {
  return (
    <PublicLayout>
      <section className="wrap center nf">
        <div>
          <p className="nf-code grad" aria-hidden="true">404</p>
          <h1 className="h-lg">This page isn&apos;t on the tender list.</h1>
          <p className="lead">
            The link may be old, mistyped, or the page has moved. Your tenders, profile and saved work are safe.
          </p>
          <div className="cta-row">
            <Link href="/"><button className="primary big">Go to home</button></Link>
            <Link href="/tenders"><button className="big">Find tenders</button></Link>
          </div>
          <p className="nf-links muted">
            Or try <Link href="/features">Features</Link> · <Link href="/how-it-works">How it works</Link> ·{" "}
            <Link href="/dashboard">Dashboard</Link>
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
