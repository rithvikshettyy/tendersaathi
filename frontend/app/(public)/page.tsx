import Link from "next/link";
import Reveal from "@/components/Reveal";
import HeroGrass from "@/components/HeroGrass";

const SOURCES = ["GeM", "eProcure", "eTenders", "TenderDetail", "Tender247", "BidAssist", "State portals", "Private vendor portals"];
const LANGS = ["English", "हिन्दी", "বাংলা", "தமிழ்", "తెలుగు", "ಕನ್ನಡ", "മലയാളം", "मराठी", "ગુજરાતી", "ਪੰਜਾਬੀ", "ଓଡ଼ିଆ"];
const STEPS = [
  ["Register", "Add your products, services and company details. Categories are set for you."],
  ["Discover", "One click searches government and private tender sources across India."],
  ["Analyse", "Upload a PDF. Check eligibility, buyer risk and likely competitors."],
  ["Bid", "Follow the checklist and fill pack. You sign and submit yourself."],
] as const;
const FAQ = [
  ["Does TenderSaathi submit bids for me?", "No. It prepares your data and a step list. You log in, sign with your DSC and solve any captcha yourself."],
  ["Where does the tender data come from?", "Public web search results across government and private tender sites. Always confirm on the official portal."],
  ["How reliable is the risk view?", "It is best-effort, built from public snippets. Use it as a pointer for your own checks."],
  ["Which languages does the assistant support?", "English plus ten Indian languages, powered by Sarvam."],
] as const;

function Mockup() {
  const rows = [
    ["Supply of LED street lights", "Government", "Well aligned", "g"],
    ["Copper cable, 1.1 kV, 5 km", "Private", "Partially aligned", "a"],
    ["Transformer maintenance AMC", "Government", "Not aligned", "r"],
  ] as const;
  return (
    <div className="frame">
      <div className="frame-bar"><i /><i /><i /><span>tendersaathi / dashboard</span></div>
      <div className="frame-body">
        <div className="mk-side"><b>Tender<em>Saathi</em></b><span className="on">Dashboard</span><span>Tenders</span><span>Schemes</span><span>Chat</span></div>
        <div className="mk-main">
          <div className="mk-stats">
            <div><small>Tracked</small><b>48</b></div>
            <div><small>Well aligned</small><b>12</b></div>
            <div><small>High-risk buyers</small><b>3</b></div>
          </div>
          <div className="mk-row head"><span>Latest tenders</span><span>Fit</span></div>
          {rows.map(([t, k, v, c]) => (
            <div className="mk-row" key={t}>
              <span>{t} <em>{k}</em></span><span className={`dot ${c}`}>{v}</span>
            </div>
          ))}
        </div>
        <div className="mk-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" /><circle className="v" cx="60" cy="60" r="48" /></svg><b>78</b><small>Bid readiness</small></div>
      </div>
      <p className="sample">Sample data for illustration</p>
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="phero">
        <HeroGrass />
        <div className="wrap center">
          <span className="badge"><b>Tender intelligence</b> for Indian manufacturers & service providers</span>
          <h1 className="h-xl">Know if you qualify <span className="grad">before you read page one.</span></h1>
          <p className="lead">Discovery across government and private portals, instant eligibility checks on tender PDFs, buyer risk signals and a bid readiness score. All in one workspace.</p>
          <div className="cta-row">
            <Link href="/signup"><button className="primary big">Get started free</button></Link>
            <a href="#how"><button className="big">See how it works</button></a>
          </div>
        </div>
        <div className="wrap hero-mock"><Reveal><Mockup /></Reveal></div>
      </section>

      {/* SOURCES */}
      <section className="wrap sec tight">
        <p className="center muted small">Searches public sources including</p>
        <div className="chips">{SOURCES.map(s => <span key={s}>{s}</span>)}</div>
      </section>

      {/* BENTO FEATURES */}
      <section className="wrap sec" id="product">
        <Reveal>
          <span className="eyebrow">Platform</span>
          <h2 className="h-lg">Everything between a search and a submission.</h2>
          <p className="lead small">Examples on this page use sample data.</p>
        </Reveal>
        <div className="bento">
          <Reveal className="b-wide"><div className="tile">
            <span className="tag">Discovery</span><h3>Auto-categorised tender feed</h3>
            <p>Describe what you make or provide. We place you in the right categories and surface government and private tenders from across India.</p>
            <div className="catrow">{["Electrical & Electronics", "Civil & Construction", "Machinery & Engineering", "Solar & Renewable"].map(c => <span key={c}>{c}</span>)}</div>
          </div></Reveal>
          <Reveal delay={80}><div className="tile">
            <span className="tag">Eligibility</span><h3>PDF check</h3>
            <p>EMD, turnover, experience and certificate clauses read for you.</p>
            <ul className="flags"><li className="g">Turnover OK</li><li className="a">Missing ISO 14001</li><li className="r">Experience short</li></ul>
          </div></Reveal>
          <Reveal delay={0}><div className="tile">
            <span className="tag">Risk</span><h3>Buyer signals</h3>
            <p>Disputes, delays and blacklist mentions, plus who has bid before.</p>
            <div className="meter"><i style={{ width: "62%" }} /></div><small className="muted">Medium risk</small>
          </div></Reveal>
          <Reveal delay={80}><div className="tile">
            <span className="tag">Readiness</span><h3>Bid score, 0 to 100</h3>
            <p>A live score from your documents, profile, fit and time left.</p>
          </div></Reveal>
          <Reveal delay={160}><div className="tile">
            <span className="tag">Schemes</span><h3>Benefits matched</h3>
            <p>MSME, startup and procurement schemes that fit your profile.</p>
          </div></Reveal>
        </div>
      </section>

      {/* HOW */}
      <section className="wrap sec" id="how">
        <Reveal><span className="eyebrow">How it works</span><h2 className="h-lg">From blank profile to confident bid.</h2></Reveal>
        <div className="step-grid">
          {STEPS.map(([t, d], i) => (
            <Reveal key={t} delay={i * 80}><div className="step-card">
              <span className="big-n">{String(i + 1).padStart(2, "0")}</span><h3>{t}</h3><p>{d}</p>
            </div></Reveal>
          ))}
        </div>
      </section>

      {/* SPLIT: eligibility */}
      <section className="wrap sec">
        <div className="split">
          <Reveal><div>
            <span className="eyebrow">Know before you bid</span>
            <h2 className="h-lg">Stop spending days on tenders you cannot win.</h2>
            <p className="lead">Upload the tender document and get a clear verdict against your own profile, with every flag explained and the clause it came from.</p>
            <ul className="ticks"><li>Turnover, experience and certification checks</li><li>MSE and startup relaxations spotted for you</li><li>Scope match against your products</li></ul>
          </div></Reveal>
          <Reveal delay={100}><div className="tile verdict">
            <div className="v-head"><b className="g">Partially aligned</b><span>Scope match 64%</span></div>
            <p className="g">Turnover OK: need about ₹1 Cr, you have ₹2 Cr</p>
            <p className="a">Certifications missing: ISO 14001</p>
            <p className="g">MSE relaxations available to you</p>
            <p className="a">EMD about ₹50,000. MSEs often exempt</p>
            
          </div></Reveal>
        </div>
      </section>

      {/* LANGUAGES */}
      <section className="wrap sec tight">
        <Reveal><div className="band left">
          <span className="eyebrow">Multilingual assistant</span>
          <h2 className="h-lg">Ask in your language. Get answers grounded in your tenders.</h2>
          <div className="chips left">{LANGS.map(l => <span key={l}>{l}</span>)}</div>
        </div></Reveal>
      </section>

      {/* STATS */}
      <section className="wrap sec tight">
        <Reveal><div className="strip">
          <div><b>Gov + Private</b><span>one combined search</span></div>
          <div><b>14</b><span>industry categories</span></div>
          <div><b>15</b><span>readiness checkpoints</span></div>
          <div><b>13</b><span>schemes matched</span></div>
        </div></Reveal>
      </section>

      {/* FAQ */}
      <section className="wrap sec">
        <div className="split">
          <Reveal><div><span className="eyebrow">FAQ</span><h2 className="h-lg">Straight answers.</h2>
            <p className="lead">More on <Link href="/about">how we handle data and automation</Link>.</p></div></Reveal>
          <Reveal delay={80}><div className="faq">
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div></Reveal>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="wrap sec tight">
        <Reveal><div className="band">
          <h2 className="h-lg">Your next tender starts with your profile.</h2>
          <p className="lead" style={{ margin: "0 auto 26px" }}>Register in a couple of minutes. Categories are set automatically.</p>
          <Link href="/signup"><button className="primary big">Create free account</button></Link>
        </div></Reveal>
      </section>
    </>
  );
}
