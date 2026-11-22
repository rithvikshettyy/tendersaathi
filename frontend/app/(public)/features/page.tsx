import Link from "next/link";

const FEATURES = [
  ["Auto-categorisation", "Tell us what you make or provide. We place you in the right tender categories.",
    ["14 industry categories", "Updates when you edit your profile"]],
  ["Tender discovery", "Search government and private tender sources across India in one click.",
    ["GeM, e-procurement and aggregators", "Tagged government or private"]],
  ["PDF eligibility check", "Upload a tender document and see if it fits before you spend time on it.",
    ["EMD, turnover, experience, certificates", "Red / amber / green flags"]],
  ["Buyer risk & competitors", "Public signals on the issuing organisation and who has bid before.",
    ["Dispute, delay and blacklist signals", "Past offer values where public"]],
  ["Bid readiness score", "A 0–100 score showing how prepared your bid really is.",
    ["15-item document checklist", "Gap list and deadline timing"]],
  ["Schemes & benefits", "MSME, startup and procurement schemes matched to your profile.",
    ["EMD exemption, purchase preference", "Links to official portals"]],
  ["Multilingual assistant", "Ask questions about your tenders in your own language.",
    ["Hindi, Tamil, Telugu, Bengali and more", "Answers grounded in your data"]],
  ["Assisted form filling", "A ready data pack and step list for the portal forms.",
    ["You keep login, DSC and captcha", "No automated submissions"]],
] as const;

export default function Features() {
  return (
    <>
      <section className="wrap sec tight" style={{ paddingTop: 150 }}>
        <span className="eyebrow">Features</span>
        <h1 className="h-xl" style={{ fontSize: "clamp(32px,5vw,52px)" }}>Everything you need <span className="grad">before you bid.</span></h1>
        <p className="lead">Eight tools, one workspace. Each one removes a reason to lose a tender.</p>
      </section>
      <section className="wrap sec tight">
        <div className="cols">
          {FEATURES.map(([t, d, pts], i) => (
            <div className="tile" key={t}>
              <span className="ico">{String(i + 1).padStart(2, "0")}</span>
              <h3>{t}</h3><p>{d}</p>
              <ul>{pts.map(p => <li key={p}>{p}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
      <section className="wrap sec tight">
        <div className="band">
          <h2 className="h-lg">See it with your own products.</h2>
          <Link href="/signup"><button className="primary big">Get started</button></Link>
        </div>
      </section>
    </>
  );
}
