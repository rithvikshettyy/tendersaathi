import Link from "next/link";

const STEPS = [
  ["Register your company", "Add your details, what you manufacture and the services you offer. We map you to tender categories automatically."],
  ["Discover matching tenders", "One click searches government and private sources across India. Results are tagged and filtered by category."],
  ["Analyse before you commit", "Upload the tender PDF to check eligibility, run a buyer risk check, and see likely competitors and past offers."],
  ["Check your readiness", "Tick off documents on the checklist. Your 0–100 score shows what is still missing and how much time is left."],
  ["Prepare and submit", "Use the fill pack and steps to complete the portal forms. You log in, sign with your DSC and submit yourself."],
] as const;

export default function HowItWorks() {
  return (
    <>
      <section className="wrap sec tight" style={{ paddingTop: 96 }}>
        <span className="eyebrow">How it works</span>
        <h1 className="h-xl" style={{ fontSize: "clamp(32px,5vw,52px)" }}>Five steps. <span className="grad">No guesswork.</span></h1>
        <p className="lead">A simple path from a blank profile to a confident bid.</p>
      </section>
      <section className="wrap sec tight">
        <div className="steps">
          {STEPS.map(([t, d], i) => (
            <div className="step-row" key={t}><span className="n">{i + 1}</span><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>
      <section className="wrap sec tight">
        <div className="band">
          <h2 className="h-lg">Ready to try step one?</h2>
          <Link href="/signup"><button className="primary big">Register your company</button></Link>
        </div>
      </section>
    </>
  );
}
