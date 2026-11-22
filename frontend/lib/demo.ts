/**
 * Sample (synthetic) data so every screen works without live sources:
 * tenders, PDF eligibility checks, buyer risk, bid readiness, fill pack, schemes and chat.
 *
 * Used only as a fallback: when the backend is unreachable, has no tenders, or the live search
 * isn't available. Real tenders always win. Everything here is deterministic (same tender, same
 * numbers) and clearly marked as sample data in the UI. It is not real award or buyer data.
 */
import type { Analysis, Company, FillPack, Flag, Intel, Readiness, Scheme, Tender } from "./types";
import { daysLeft } from "./tenders";

export class DemoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Kind = "government" | "private/aggregator";
interface Tpl { title: string; org: string; kind: Kind; category: string; source: string; snippet: string }

const G: Kind = "government", P: Kind = "private/aggregator";
const POOL: Tpl[] = [
  { title: "Supply of LED street lights, 5,000 units", org: "Municipal Corporation", kind: G, category: "Electrical & Electronics", source: "gem.gov.in", snippet: "Supply, delivery and commissioning of 90W LED street lights with 5-year warranty." },
  { title: "Copper cable 1.1 kV, 5 km, supply and laying", org: "State Power Distribution Company", kind: G, category: "Electrical & Electronics", source: "eprocure.gov.in", snippet: "Armoured copper cable supply and laying for network strengthening works." },
  { title: "Rate contract for transformer maintenance (AMC)", org: "Regional Power Transmission Limited", kind: P, category: "Electrical & Electronics", source: "tender247.com", snippet: "Annual maintenance of distribution transformers across three divisions." },
  { title: "Construction of office building, Phase II", org: "PWD Department", kind: G, category: "Civil & Construction", source: "eprocure.gov.in", snippet: "Civil, plumbing and finishing works for a G+3 administrative block." },
  { title: "Supply of cement and steel for road works", org: "State Road Development Corporation", kind: G, category: "Civil & Construction", source: "etenders.gov.in", snippet: "OPC 53 grade cement and TMT bars for state highway upgrades." },
  { title: "Paver block laying for industrial township", org: "Industrial Township Authority", kind: P, category: "Civil & Construction", source: "tenderdetail.com", snippet: "Supply and laying of interlocking paver blocks across internal roads." },
  { title: "Supply of desktop computers and UPS", org: "State Education Board", kind: G, category: "IT & Software", source: "gem.gov.in", snippet: "300 desktops with 3-year onsite warranty and 1 kVA UPS units." },
  { title: "Annual maintenance of CCTV network", org: "Metro Rail Corporation", kind: G, category: "IT & Software", source: "eprocure.gov.in", snippet: "Comprehensive AMC for 420 cameras, recorders and network switches." },
  { title: "Website redesign and hosting services", org: "Tourism Development Board", kind: P, category: "IT & Software", source: "bidassist.com", snippet: "Redesign, content migration and 3-year managed hosting." },
  { title: "Supply of staff uniforms, 2,000 sets", org: "State Transport Corporation", kind: G, category: "Textiles & Apparel", source: "gem.gov.in", snippet: "Polyester-cotton uniforms with stitching, as per approved samples." },
  { title: "Hospital linen and bedsheets", org: "District Hospital Society", kind: G, category: "Textiles & Apparel", source: "etenders.gov.in", snippet: "Cotton bedsheets, pillow covers and surgical linen, annual rate contract." },
  { title: "Supply of packaged food grains", org: "Civil Supplies Corporation", kind: G, category: "Food & Agro", source: "eprocure.gov.in", snippet: "Rice, wheat and pulses in 25 kg bags to district warehouses." },
  { title: "Bulk spices and condiments for canteens", org: "Institutional Catering Services", kind: P, category: "Food & Agro", source: "tendersontime.com", snippet: "FSSAI-compliant spices, quarterly supply with batch certificates." },
  { title: "Supply of surgical masks and gloves", org: "State Medical Services Corporation", kind: G, category: "Medical & Pharma", source: "gem.gov.in", snippet: "3-ply masks and nitrile examination gloves, rate contract." },
  { title: "Diagnostic reagents rate contract", org: "Government Medical College", kind: G, category: "Medical & Pharma", source: "etenders.gov.in", snippet: "Biochemistry and haematology reagents with analyser compatibility." },
  { title: "Fabrication of steel structures", org: "Port Trust Authority", kind: G, category: "Machinery & Engineering", source: "eprocure.gov.in", snippet: "Fabrication, galvanising and erection of steel gantries." },
  { title: "Supply of industrial pumps and valves", org: "Water Supply Board", kind: G, category: "Machinery & Engineering", source: "gem.gov.in", snippet: "Centrifugal pumps, gate valves and fittings for treatment plants." },
  { title: "HDPE pipes for water mains", org: "City Water Board", kind: G, category: "Chemicals & Plastics", source: "etenders.gov.in", snippet: "PE100 HDPE pipes, 110 to 315 mm, with BIS certification." },
  { title: "Industrial paints and coatings", org: "Shipyard Limited", kind: P, category: "Chemicals & Plastics", source: "tender247.com", snippet: "Marine-grade epoxy and anti-corrosive coatings, 2,000 litres." },
  { title: "Office furniture for new administrative block", org: "High Court Registry", kind: G, category: "Furniture & Stationery", source: "gem.gov.in", snippet: "Workstations, chairs and storage units with 5-year warranty." },
  { title: "Stationery rate contract FY 2026-27", org: "State University", kind: G, category: "Furniture & Stationery", source: "eprocure.gov.in", snippet: "Paper, files and consumables, quarterly indent supply." },
  { title: "Printing of examination material", org: "State Examination Board", kind: G, category: "Printing & Packaging", source: "etenders.gov.in", snippet: "Secure printing and packing of question papers with tracking." },
  { title: "Corrugated boxes for dispatch", org: "Dairy Federation", kind: P, category: "Printing & Packaging", source: "bidassist.com", snippet: "5-ply corrugated boxes, printed, monthly delivery." },
  { title: "Solar rooftop installation, 250 kW", org: "Municipal Hospital Trust", kind: G, category: "Solar & Renewable", source: "gem.gov.in", snippet: "Design, supply and commissioning with net metering and 5-year O&M." },
  { title: "Solar street lights, 1,000 units", org: "Rural Development Agency", kind: G, category: "Solar & Renewable", source: "eprocure.gov.in", snippet: "Integrated solar LED street lights with lithium batteries." },
  { title: "Hiring of vehicles for field staff", org: "District Administration", kind: G, category: "Transport & Logistics", source: "gem.gov.in", snippet: "Monthly hiring of 20 vehicles with driver and fuel." },
  { title: "Warehousing and last-mile delivery", org: "Regional Logistics Cooperative", kind: P, category: "Transport & Logistics", source: "tenderdetail.com", snippet: "Warehouse space and delivery services across five districts." },
  { title: "Housekeeping and sanitation services", org: "Airport Operations Authority", kind: G, category: "Housekeeping & Security Services", source: "eprocure.gov.in", snippet: "Manpower-based housekeeping for terminal and offices, 2-year contract." },
  { title: "Security guards for government offices", org: "State Secretariat", kind: G, category: "Housekeeping & Security Services", source: "gem.gov.in", snippet: "Armed and unarmed guards across 12 office complexes." },
  { title: "Skill training programme, 500 trainees", org: "Skill Development Mission", kind: G, category: "Consulting & Training", source: "etenders.gov.in", snippet: "Classroom and on-the-job training with placement tracking." },
  { title: "Third-party quality audit services", org: "Infrastructure Development Board", kind: P, category: "Consulting & Training", source: "tendersontime.com", snippet: "Independent quality audits of civil works across 40 sites." },
];

const COMPETITORS = [
  "Sunrise Electricals Pvt Ltd", "Bharat Infra Projects Ltd", "Kaveri Industries", "Metro Engineers & Associates",
  "Shree Ganesh Enterprises", "Northern Supplies Pvt Ltd", "Apex Solutions Limited", "Greenfield Constructions",
  "Orion Traders", "Pioneer Systems Pvt Ltd",
];
const SIGNALS = [
  { signal: "delay", text: "Vendor forums mention payment cycles stretching past 90 days (sample)" },
  { signal: "cancelled", text: "An earlier tender for similar work was cancelled and re-floated (sample)" },
  { signal: "dispute", text: "One arbitration matter reported with a past contractor (sample)" },
  { signal: "penalty", text: "Liquidated-damages clauses applied on late deliveries (sample)" },
];

/* ---------- deterministic randomness ---------- */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n: number) => String(n).padStart(2, "0");
const dmy = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
const sqlTs = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const addDays = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const idOf = (idx: number) => -(idx + 1);
const idxOf = (id: number) => -id - 1;

/* ---------- on-device state ---------- */
interface Extra { idx: number; found: string }
interface State {
  extra: Extra[]; custom: Tender[]; searches: number;
  analyzed: Record<string, boolean>; risked: Record<string, boolean>; checklist: Record<string, Record<string, boolean>>;
}
let profile: Company | null = null;
const skey = () => `ts_demo:${(profile?.email || "anon").toLowerCase()}`;
const blank = (): State => ({ extra: [], custom: [], searches: 0, analyzed: {}, risked: {}, checklist: {} });
function load(): State {
  try { return { ...blank(), ...(JSON.parse(localStorage.getItem(skey()) || "{}") as Partial<State>) }; } catch { return blank(); }
}
function save(s: State) { try { localStorage.setItem(skey(), JSON.stringify(s)); } catch { /* storage blocked */ } }

const OFF = "ts_demo_off";
export const isEnabled = () => { try { return localStorage.getItem(OFF) !== "1"; } catch { return true; } };
export function setEnabled(on: boolean) {
  try { if (on) localStorage.removeItem(OFF); else localStorage.setItem(OFF, "1"); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event("ts:demo"));
}
export const setProfile = (c: Company | null) => { profile = c; };

/* ---------- tenders ---------- */
function baseIdx(p: Company | null): number[] {
  const cats = (p?.categories ?? []).slice(0, 3);
  const mine = POOL.map((t, i) => (cats.includes(t.category) ? i : -1)).filter(i => i >= 0);
  const rest = POOL.map((_, i) => i).filter(i => !mine.includes(i)).filter((_, k) => k % 3 === 0);
  return [...mine, ...rest.slice(0, Math.max(0, 8 - mine.length))];
}

function build(idx: number, found?: string): Tender {
  const t = POOL[idx], id = idOf(idx);
  const offsets = [3, 6, 9, 14, 21, 28, 35, 45];
  const ago = (hash("f" + id) % 7) * 86400e3 + (hash("h" + id) % 20) * 3600e3;
  return {
    id, title: t.title, link: `demo:${idx}`, snippet: t.snippet, source: t.source, kind: t.kind, org: t.org,
    category: t.category, deadline: dmy(addDays(offsets[hash("d" + id) % offsets.length])),
    found: found ?? sqlTs(new Date(Date.now() - ago)), analysis: null, intel: null, demo: true,
  };
}

function withDerived(t: Tender, s: State): Tender {
  if (!profile || t.id > 0) return t;
  const analysed = s.analyzed[t.id] ?? hash("a" + t.id) % 100 < 60;
  const risked = s.risked[t.id] ?? hash("r" + t.id) % 100 < 35;
  return { ...t, analysis: analysed ? analysisFor(t, profile) : null, intel: risked ? intelFor(t) : null };
}

function allTenders(): Tender[] {
  const s = load();
  const idxs = [...new Set([...baseIdx(profile), ...s.extra.map(e => e.idx)])];
  const foundOf = (i: number) => s.extra.find(e => e.idx === i)?.found;
  const list = [...s.custom, ...idxs.map(i => build(i, foundOf(i)))].map(t => withDerived(t, s));
  return list.sort((a, b) => (a.found < b.found ? 1 : -1));
}

function findTender(id: number): Tender {
  const t = allTenders().find(x => x.id === id);
  if (!t) throw new DemoError(404, "Tender not found");
  return t;
}

function searchMore(): { found: number; new: number; demo: true } {
  const s = load();
  const have = new Set(allTenders().map(t => t.id));
  const fresh: number[] = [];
  for (let k = 0; k < POOL.length && fresh.length < 4; k++) {
    const idx = (s.searches * 5 + k) % POOL.length;
    if (!have.has(idOf(idx)) && !fresh.includes(idx)) fresh.push(idx);
  }
  const now = sqlTs(new Date());
  s.extra.push(...fresh.map(idx => ({ idx, found: now })));
  s.searches += 1; save(s);
  return { found: fresh.length, new: fresh.length, demo: true };
}

function addCustom(body: { title: string; link?: string; org?: string; deadline?: string }): { id: number } {
  const s = load();
  const id = -(1000 + s.custom.length + 1);
  s.custom.push({ id, title: body.title, link: body.link || `demo:custom${id}`, snippet: "", source: "manual", kind: "manual",
    org: body.org || "", category: "General Supplies", deadline: body.deadline || "", found: sqlTs(new Date()), analysis: null, intel: null, demo: true });
  save(s);
  return { id };
}

/* ---------- PDF eligibility check (synthetic) ---------- */
function analysisFor(t: Tender, p: Company): Analysis {
  const r = rng("an" + t.id);
  const turnoverReq = [0.5, 1, 2, 5, 10][Math.floor(r() * 5)];
  const expReq = [2, 3, 5][Math.floor(r() * 3)];
  const certs = [["ISO 9001"], ["ISO 9001", "BIS"], ["ISO 14001"], ["BIS"], ["NABL"]][Math.floor(r() * 5)];
  const emd = [25000, 50000, 100000, 250000][Math.floor(r() * 4)];
  const mse = r() < 0.6;
  const small = p.size === "micro" || p.size === "small";
  const inCat = p.categories.includes(t.category);
  const scope = Math.round(inCat ? 68 + r() * 27 : 12 + r() * 40);
  const have = (p.certifications || "").toLowerCase();
  const flags: Flag[] = [];
  const turn = p.turnover_cr || 0;
  if (turn >= turnoverReq) flags.push({ level: "green", msg: `Turnover OK: need ~₹${turnoverReq} Cr, you have ₹${turn} Cr` });
  else if (small && mse) flags.push({ level: "amber", msg: `Turnover short (need ₹${turnoverReq} Cr) but the tender mentions MSE relaxation. Claim it.` });
  else flags.push({ level: "red", msg: `Turnover too low: need ~₹${turnoverReq} Cr, you have ₹${turn} Cr` });
  const years = p.years || 0;
  if (years >= expReq) flags.push({ level: "green", msg: `Experience OK: need ${expReq} yrs` });
  else if (p.startup) flags.push({ level: "amber", msg: `Experience short (${expReq} yrs) but startup relaxation is likely. Check the clause.` });
  else flags.push({ level: "red", msg: `Experience short: need ${expReq} yrs, you have ${years}` });
  const missing = certs.filter(c => !have.includes(c.toLowerCase()));
  flags.push(missing.length ? { level: "amber", msg: "Certifications mentioned that you don't list: " + missing.join(", ") } : { level: "green", msg: "Listed certifications cover those mentioned" });
  if (mse && small) flags.push({ level: "green", msg: "MSE relaxations available to you (EMD/turnover/experience)" });
  flags.push({ level: emd > 100000 ? "amber" : "green", msg: `EMD ≈ ₹${emd.toLocaleString("en-IN")}` + (small ? " (MSEs often exempt: attach Udyam/NSIC)" : "") });
  flags.push(scope >= 50 ? { level: "green", msg: `Scope match strong (${scope}% of your product/service terms appear)` }
    : scope >= 20 ? { level: "amber", msg: `Scope match partial (${scope}%). Verify item specs.` }
    : { level: "red", msg: `Scope match weak (${scope}%). Tender may not suit your products.` });
  const reds = flags.filter(f => f.level === "red").length, ambers = flags.filter(f => f.level === "amber").length;
  const verdict = reds >= 2 || (reds && scope < 20) ? "Not aligned" : reds || ambers >= 3 ? "Partially aligned" : "Well aligned";
  return {
    verdict, scope_match_pct: scope, flags,
    terms: { emd_rupees: emd, min_turnover_cr: turnoverReq, min_experience_years: expReq, deadline: t.deadline,
      certifications_mentioned: certs, mse_relaxation: mse, startup_relaxation: false, make_in_india: r() < 0.3,
      oem_only: false, local_presence_required: false, warranty: "12 months", delivery: "45 days", sample: true },
  };
}

/* ---------- buyer risk and competitors (synthetic) ---------- */
function intelFor(t: Tender): Intel {
  const r = rng("in" + t.id);
  const score = Math.floor(r() * 13);
  const level = score >= 8 ? "High" : score >= 3 ? "Medium" : "Low";
  const n = score >= 8 ? 3 : score >= 3 ? 2 : score > 0 ? 1 : 0;
  const picks = [...SIGNALS].sort(() => r() - 0.5).slice(0, n);
  const comps = [...COMPETITORS].sort(() => r() - 0.5).slice(0, 4 + Math.floor(r() * 3));
  const amt = () => (r() < 0.5 ? `₹ ${(0.4 + r() * 4).toFixed(1)} crore` : `₹ ${Math.round(20 + r() * 80)} lakh`);
  return {
    subject: t.org || t.title, risk_level: level, risk_score: score,
    flags: picks.map(p => ({ signal: p.signal, source: "", text: p.text })),
    competitors: comps.map((name, i) => ({ name, mentions: Math.max(1, 6 - i - Math.floor(r() * 2)) })),
    past_offers: [0, 1, 2].map(i => ({ amount: amt(), context: `Sample award, FY 2025-26: L1 quote reported near this value (${comps[i % comps.length]}).`, source: "" })),
    note: "Sample data for demonstration. Not from real award or buyer records.",
  };
}

/* ---------- bid readiness (same formula as the backend) ---------- */
const ITEMS: [string, string, number][] = [
  ["gst", "GST registration certificate", 6], ["pan", "Company PAN", 4], ["udyam", "Udyam / NSIC certificate", 6],
  ["iso", "ISO / quality certificates", 5], ["balance", "Last 3 yrs audited balance sheets", 8],
  ["itr", "ITR + CA turnover certificate", 6], ["exp", "Past work/supply orders + completion certificates", 8],
  ["solvency", "Bank solvency / ability-to-pay letter", 4], ["dsc", "Class-3 Digital Signature Certificate", 6],
  ["portal", "Registered on the tender portal", 4], ["emd", "EMD / bid security arranged (or exemption doc)", 6],
  ["spec", "Technical specs compliance sheet", 8], ["price", "Price bid / BOQ prepared", 8],
  ["undertake", "Undertakings, affidavits, integrity pact", 4], ["authorisation", "Authorisation letter / board resolution", 3],
];

function readinessFor(t: Tender, p: Company, checked: Record<string, boolean>): Readiness {
  const totalW = ITEMS.reduce((a, [, , w]) => a + w, 0);
  const doneW = ITEMS.reduce((a, [k, , w]) => a + (checked[k] ? w : 0), 0);
  const fields = [p.name, p.gstin, p.udyam, p.state, p.city, p.size, p.products, p.certifications];
  const completeness = fields.filter(Boolean).length / 8 + (p.turnover_cr ? 0 : -0.1);
  const docs = (50 * doneW) / totalW;
  const prof = 20 * Math.max(0, completeness);
  const align = ({ "Well aligned": 20, "Partially aligned": 11, "Not aligned": 3 } as Record<string, number>)[t.analysis?.verdict ?? ""] ?? 8;
  const days = daysLeft(t.deadline || (t.analysis?.terms as { deadline?: string } | undefined)?.deadline);
  const remaining = totalW - doneW;
  const timing = days === null ? 5 : days < 0 ? 0 : days >= 7 || remaining < 12 ? 10 : days >= 3 ? 6 : 2;
  const score = Math.round(docs + prof + align + timing);
  return {
    score, grade: score >= 80 ? "Ready" : score >= 60 ? "Almost ready" : score >= 40 ? "Needs work" : "Not ready",
    days_left: days, gaps: ITEMS.filter(([k]) => !checked[k]).map(([, l]) => l),
    breakdown: { documents: Math.round(docs), profile: Math.round(prof), alignment: align, timing },
    items: ITEMS.map(([key, label, weight]) => ({ key, label, weight })), checked,
  };
}

function fillpackFor(t: Tender, u: Company): FillPack {
  return {
    tender: t.title, link: "",
    fields: {
      "Bidder / Firm name": u.name, GSTIN: u.gstin, "Udyam / NSIC no.": u.udyam, "Enterprise size": u.size, State: u.state, City: u.city,
      "Annual turnover (₹ Cr)": u.turnover_cr, "Years in business": u.years, Certifications: u.certifications,
      "Products / services offered": `${u.products}; ${u.services}`.replace(/^; |; $/g, ""),
      "Women-owned": u.women_owned ? "Yes" : "No", "Startup (DPIIT)": u.startup ? "Yes" : "No",
    },
    steps: [
      "Open the tender link and log in to the portal with your own credentials",
      "Copy the fields above into the matching form boxes",
      "Attach documents from your readiness checklist (PDF, size limits per portal)",
      "Sign with your DSC and solve the captcha yourself",
      "Pay EMD (or upload exemption) and submit before the deadline",
    ],
  };
}

/* ---------- schemes (same list as the backend) ---------- */
type P = Pick<Company, "size" | "startup" | "products" | "years" | "women_owned" | "categories">;
const SCHEMES: { name: string; desc: string; url: string; when: (c: P) => boolean }[] = [
  { name: "Public Procurement Policy for MSEs", url: "https://msme.gov.in", desc: "Central ministries/PSUs must source 25% of annual purchases from MSEs (3% sub-target for women-owned).", when: c => ["micro", "small"].includes(c.size) },
  { name: "EMD & tender-fee exemption for MSEs", url: "https://www.nsic.co.in", desc: "MSEs with Udyam/NSIC registration are commonly exempt from EMD and tender fees on central tenders.", when: c => ["micro", "small"].includes(c.size) },
  { name: "Prior experience / turnover relaxation", url: "https://dpiit.gov.in", desc: "Startups (DPIIT) and MSEs can get relaxed prior-experience and turnover norms, if quality specs are met.", when: c => c.startup || ["micro", "small"].includes(c.size) },
  { name: "Startup India (DPIIT recognition)", url: "https://www.startupindia.gov.in", desc: "Tax benefits, easier compliance and public-procurement relaxations for recognised startups.", when: c => c.startup },
  { name: "Public Procurement (Make in India) Order", url: "https://dpiit.gov.in", desc: "Purchase preference for Class-I/II local suppliers. Get local-content certificate.", when: c => !!c.products },
  { name: "GeM seller registration", url: "https://gem.gov.in", desc: "Government e-Marketplace: direct-buy and bid access to central/state buyers.", when: () => true },
  { name: "NSIC Single Point Registration", url: "https://www.nsic.co.in", desc: "Free tender documents, EMD exemption, marketing and raw-material assistance.", when: c => ["micro", "small"].includes(c.size) },
  { name: "CGTMSE collateral-free credit", url: "https://www.cgtmse.in", desc: "Credit guarantee for collateral-free MSE loans. Limits revised periodically.", when: c => ["micro", "small", "medium"].includes(c.size) },
  { name: "TReDS invoice discounting", url: "https://www.rxil.in", desc: "Discount invoices raised on large/government buyers to ease working capital between payments.", when: c => ["micro", "small", "medium"].includes(c.size) },
  { name: "PMEGP (new enterprises)", url: "https://www.kviconline.gov.in/pmegpeportal", desc: "Subsidised credit for new micro units in manufacturing/services.", when: c => c.size === "micro" && (c.years || 0) < 3 },
  { name: "MSME Champions / ZED certification", url: "https://zed.msme.gov.in", desc: "Zero Defect Zero Effect certification: subsidy on certification cost and procurement preference.", when: c => !!c.products },
  { name: "Stand-Up India / Mudra", url: "https://www.standupmitra.in", desc: "Bank loans for women and SC/ST entrepreneurs; Mudra for micro units.", when: c => !!c.women_owned },
  { name: "Production Linked Incentive (PLI)", url: "https://www.investindia.gov.in/production-linked-incentive-schemes-india", desc: "Sector schemes: electronics, pharma, textiles, food processing, solar modules, etc.", when: c => ["Electrical", "Medical", "Textiles", "Food", "Solar"].some(k => c.categories.join(" ").includes(k)) },
];
function schemesFor(c: Company): Scheme[] {
  return SCHEMES.map(s => ({ name: s.name, desc: s.desc, url: s.url, applicable: s.when(c) })).sort((a, b) => Number(b.applicable) - Number(a.applicable));
}

/* ---------- assistant (keyword-based, grounded in the sample data) ---------- */
function chatFor(q: string): { answer: string; sources: string[] } {
  const p = profile;
  if (!p) return { answer: "Sign in and finish your profile and I can answer from your data.", sources: [] };
  const text = q.toLowerCase(), has = (...w: string[]) => w.some(x => text.includes(x));
  const tenders = allTenders();
  const mine = schemesFor(p).filter(s => s.applicable);
  const sources: string[] = [];
  let answer: string;
  if (has("scheme", "benefit", "subsid", "msme", "startup", "emd", "exempt", "loan", "credit")) {
    const top = mine.slice(0, 4);
    top.forEach(s => sources.push(`Scheme: ${s.name}`));
    answer = `Based on your profile (${p.size} enterprise${p.startup ? ", startup" : ""}), these look relevant:\n\n` + top.map(s => `- ${s.name}: ${s.desc}`).join("\n");
  } else if (has("document", "checklist", "ready", "readiness", "bid", "prepare", "submit")) {
    answer = "Documents bidders are usually asked for:\n\n" + ITEMS.slice(0, 8).map(([, l]) => `- ${l}`).join("\n") + "\n\nOpen any tender and tick items in its checklist to see your bid readiness score.";
    sources.push("Bid readiness checklist");
  } else if (has("risk", "buyer", "competitor", "rival")) {
    const risky = tenders.filter(t => t.intel?.risk_level === "High");
    risky.forEach(t => sources.push(`Risk intel: ${t.title}`));
    answer = risky.length ? "Buyers flagged high-risk in your sample tenders:\n\n" + risky.map(t => `- ${t.org || t.title}`).join("\n") : "None of your tenders are flagged high-risk right now. Open a tender and run the risk analysis to see buyer signals and likely competitors.";
  } else if (has("deadline", "due", "urgent", "expire", "last date", "closing")) {
    const soon = tenders.map(t => ({ t, n: daysLeft(t.deadline) })).filter(x => x.n !== null && x.n >= 0).sort((a, b) => a.n! - b.n!).slice(0, 4);
    soon.forEach(x => sources.push(`Tender: ${x.t.title}`));
    answer = soon.length ? "Closing soonest:\n\n" + soon.map(x => `- ${x.t.title}: ${x.n === 0 ? "today" : `in ${x.n} day${x.n! > 1 ? "s" : ""}`}`).join("\n") : "No tender deadlines are known yet.";
  } else if (has("eligib", "qualify", "match", "fit", "suit")) {
    const good = tenders.filter(t => t.analysis?.verdict === "Well aligned");
    good.forEach(t => sources.push(`Analysis: ${t.title}`));
    answer = good.length ? `${good.length} of your analysed tenders look well aligned:\n\n` + good.slice(0, 4).map(t => `- ${t.title} (scope match ${t.analysis!.scope_match_pct}%)`).join("\n") : "Upload a tender PDF in a tender's workspace to check eligibility against your profile.";
  } else if (has("tender", "find", "search", "new")) {
    answer = `You are tracking ${tenders.length} tenders (${tenders.filter(t => t.kind === "government").length} government, ${tenders.filter(t => t.kind !== "government").length} private or manual). Open the Tenders page to filter or search them.`;
    tenders.slice(0, 3).forEach(t => sources.push(`Tender: ${t.title}`));
  } else {
    answer = `Hi ${p.name.split(" ")[0] || "there"}. I can help with schemes and benefits, documents for a bid, buyer risk, deadlines and eligibility. Try "Which schemes apply to me?" or "What's closing soon?".`;
  }
  return { answer: answer + "\n\n(Sample assistant. Live AI answers need the server.)", sources };
}

/* ---------- request routing ---------- */
interface Opts { method?: string; body?: unknown; form?: FormData }
const status = (e: unknown) => (e as { status?: number } | null)?.status;

function handleTender(id: number, action: string | undefined, method: string, opts: Opts): unknown {
  if (!profile) throw new DemoError(401, "Not signed in");
  const t = findTender(id), s = load();
  switch (action) {
    case "analyze": s.analyzed[id] = true; save(s); return analysisFor(t, profile);
    case "intel": s.risked[id] = true; save(s); return intelFor(t);
    case "readiness": {
      if (method === "PUT") { s.checklist[id] = (opts.body as { items: Record<string, boolean> }).items; save(s); }
      return readinessFor(withDerived(t, s), profile, s.checklist[id] ?? {});
    }
    case "fillpack": return fillpackFor(t, profile);
    default: throw new DemoError(404, "Not found");
  }
}

/** Wraps the real API call: sample data only fills gaps; real data and auth errors pass through untouched. */
export async function route<T>(path: string, opts: Opts, real: () => Promise<T>): Promise<T> {
  const method = (opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET")).toUpperCase();
  const m = path.match(/^\/tenders\/(-\d+)(?:\/(\w+))?$/);
  if (m) return handleTender(Number(m[1]), m[2], method, opts) as T;       // sample tenders live on the device
  if (!isEnabled() || !profile) return real();
  const auth = (e: unknown) => status(e) === 401 || status(e) === 403;

  if (method === "GET" && path === "/tenders") {
    try { const r = (await real()) as unknown; if (Array.isArray(r) && r.length) return r as T; } catch (e) { if (auth(e)) throw e; }
    return allTenders() as T;
  }
  if (method === "POST" && path === "/tenders/search") {
    try { return await real(); } catch (e) { if (auth(e)) throw e; return searchMore() as T; }
  }
  if (method === "POST" && path === "/tenders") {
    try { return await real(); } catch (e) { if (auth(e)) throw e; return addCustom(opts.body as { title: string }) as T; }
  }
  if (method === "GET" && path === "/schemes") {
    try { return await real(); } catch (e) { if (auth(e)) throw e; return schemesFor(profile) as T; }
  }
  if (method === "POST" && path === "/chat") {
    try { return await real(); } catch (e) { if (auth(e)) throw e; return chatFor((opts.body as { question: string }).question) as T; }
  }
  return real();
}
