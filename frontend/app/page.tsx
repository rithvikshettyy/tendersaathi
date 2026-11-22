import Link from "next/link";
import SiteNav from "@/components/SiteNav";

const FEATURES = [
  ["Auto-categorised tenders", "Tell us what you make or the services you offer. We place you in the right tender categories automatically."],
  ["Government + private search", "One click searches GeM, e-procurement portals and private/aggregator sites across India for matching tenders."],
  ["PDF eligibility check", "Upload a tender PDF. We read EMD, turnover, experience and certification clauses and warn you if it doesn't fit."],
  ["Buyer risk & competitors", "See red flags about the issuing organisation, who has bid before, and past offer values."],
  ["Bid readiness score", "A 0–100 score from your document checklist, profile, alignment and time left, with the gaps listed."],
  ["Schemes & benefits", "MSME, startup and procurement schemes matched to your profile, such as EMD exemption and purchase preference."],
  ["Multilingual chatbot", "Ask questions about your tenders in Hindi, Tamil, Telugu, Bengali and more, powered by Sarvam."],
  ["Assisted form filling", "A ready fill pack of your company data and a step list. You keep control of login, DSC and captcha."],
] as const;

const STEPS = [
  ["Register", "Add your company details, products and services."],
  ["Discover", "We find relevant government and private tenders."],
  ["Analyse", "Upload PDFs, check risk, and see your readiness score."],
  ["Bid", "Use the fill pack and checklist to submit with confidence."],
] as const;

export default function Landing() {
  return (
    <>
      <SiteNav />
      <header className="hero">
        <span className="pill">For Indian manufacturers & service providers</span>
        <h1>Win more tenders.<br />Waste less time on the wrong ones.</h1>
        <p className="lead">
          TenderSaathi finds tenders that match what you make, checks whether you actually qualify,
          warns you about risky buyers, and tells you how ready your bid is.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/signup"><button className="primary big">Register your company</button></Link>
          <Link href="/login"><button className="big">Log in</button></Link>
        </div>
      </header>

      <section id="features" className="section">
        <h2>Everything for a tender, in one place</h2>
        <div className="features">
          {FEATURES.map(([t, d]) => (
            <div className="card" key={t}><h3>{t}</h3><p className="muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section id="how" className="section">
        <h2>How it works</h2>
        <div className="features">
          {STEPS.map(([t, d], i) => (
            <div className="card" key={t}><span className="step">{i + 1}</span><h3>{t}</h3><p className="muted">{d}</p></div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link href="/signup"><button className="primary big">Get started free</button></Link>
        </div>
      </section>

      <footer className="footer">
        © TenderSaathi · Tender data comes from public search results; always verify on the official portal.
      </footer>
    </>
  );
}
