import Link from "next/link";

const HIGHLIGHTS = [
  ["01", "Find", "Tenders matched to what you make, from government and private portals across India."],
  ["02", "Qualify", "Upload a tender PDF. We check it against your profile and flag mismatches early."],
  ["03", "Prepare", "A readiness score, buyer risk signals and a document checklist before you bid."],
] as const;

export default function Home() {
  return (
    <>
      <section className="phero">
        <div className="wrap center">
          <span className="badge"><b>New</b> · Built for Indian manufacturers & service providers</span>
          <h1 className="h-xl">Bid on the tenders <span className="grad">you can actually win.</span></h1>
          <p className="lead">
            TenderSaathi finds tenders that fit your products, checks your eligibility, warns you about
            risky buyers, and scores how ready your bid is.
          </p>
          <div className="cta-row">
            <Link href="/signup"><button className="primary big">Register your company</button></Link>
            <Link href="/how-it-works"><button className="big">See how it works</button></Link>
          </div>
        </div>
      </section>

      <section className="wrap sec tight">
        <div className="strip">
          <div><b>Gov + Private</b><span>one search, both worlds</span></div>
          <div><b>11 languages</b><span>chat in your own</span></div>
          <div><b>0–100</b><span>bid readiness score</span></div>
          <div><b>13 schemes</b><span>matched to your profile</span></div>
        </div>
      </section>

      <section className="wrap sec">
        <span className="eyebrow">The idea</span>
        <h2 className="h-lg">From search to submission, without the guesswork.</h2>
        <div className="cols" style={{ marginTop: 32 }}>
          {HIGHLIGHTS.map(([n, t, d]) => (
            <div className="tile" key={t}><span className="ico">{n}</span><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
        <p style={{ marginTop: 24 }}><Link href="/features">Explore all features →</Link></p>
      </section>

      <section className="wrap sec tight">
        <div className="band">
          <h2 className="h-lg">Start with your company profile.</h2>
          <p className="lead" style={{ margin: "0 auto 26px" }}>Takes a couple of minutes. Your categories are set automatically.</p>
          <Link href="/signup"><button className="primary big">Create free account</button></Link>
        </div>
      </section>
    </>
  );
}
