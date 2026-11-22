import Link from "next/link";

const FAQ = [
  ["Does TenderSaathi submit bids for me?", "No. It prepares your data and a step list. You log in to the portal, sign with your Digital Signature Certificate and solve any captcha yourself."],
  ["Where does tender data come from?", "Public web search results across government and private tender sites. Always confirm dates, values and eligibility on the official portal."],
  ["How reliable is the risk and competitor view?", "It is best-effort, built from public snippets. Treat it as a pointer for your own checks, not a verdict."],
  ["Are the scheme details current?", "They are general summaries. Limits and eligibility change, so every scheme links to its official site."],
  ["Can it read scanned PDFs?", "Not yet. PDFs need selectable text; OCR is not included."],
  ["Which languages does the chatbot support?", "English, Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi and Odia."],
] as const;

export default function About() {
  return (
    <>
      <section className="wrap sec tight" style={{ paddingTop: 96 }}>
        <span className="eyebrow">About</span>
        <h1 className="h-xl" style={{ fontSize: "clamp(32px,5vw,52px)" }}>Tenders are open to all. <span className="grad">Few are ready.</span></h1>
        <p className="lead">
          Small manufacturers and service providers lose bids to missed clauses, missing documents and
          unseen buyer risk, not to weak products. TenderSaathi puts that checking in one place.
        </p>
      </section>

      <section className="wrap sec tight">
        <div className="cols">
          <div className="tile"><h3>Honest by design</h3><p>We flag what we are unsure about and point you to the official source.</p></div>
          <div className="tile"><h3>You stay in control</h3><p>No hidden automation. You review, sign and submit every bid.</p></div>
          <div className="tile"><h3>Built for India</h3><p>MSME schemes, GeM, state portals and regional languages from day one.</p></div>
        </div>
      </section>

      <section className="wrap sec tight">
        <span className="eyebrow">FAQ</span>
        <h2 className="h-lg">Common questions</h2>
        <div className="faq" style={{ marginTop: 16 }}>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </section>

      <section className="wrap sec tight">
        <div className="band">
          <h2 className="h-lg">Ready when you are.</h2>
          <Link href="/signup"><button className="primary big">Create free account</button></Link>
        </div>
      </section>
    </>
  );
}
