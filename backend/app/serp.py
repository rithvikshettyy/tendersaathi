import os, re, collections
import httpx
from . import db, sources

AGGREGATORS = ("tenderdetail", "tender247", "bidassist", "tendersontime", "tenderwatch",
               "indiamart", "tradeindia", "google", "linkedin", "facebook", "youtube")
ORG_RE = re.compile(
    r"((?:[A-Z][\w&.\-]+\s){1,5}(?:Limited|Ltd\.?|Corporation|Authority|Board|Department|"
    r"Ministry|University|Railways?|Council|Commission|Nigam|Institute|Municipal Corporation))")
COMP_RE = re.compile(
    r"((?:[A-Z][\w&.\-]+\s){1,4}(?:Pvt\.?\s?Ltd\.?|Private Limited|Limited|Ltd\.?|Industries|"
    r"Enterprises|Engineers|Infra\w*|Projects|Associates|Traders|Solutions|Constructions?))")
AMOUNT_RE = re.compile(r"(?:₹|\bRs\.?|\bINR)\s?\d[\d,]*(?:\.\d+)?\s?(?:crore|cr|lakhs?|million)?", re.I)
RISK_WORDS = {"blacklist": 3, "debar": 3, "scam": 3, "corruption": 3, "arbitration": 2,
              "dispute": 2, "litigation": 2, "cancelled": 2, "canceled": 2, "retender": 2,
              "delay": 1, "penalty": 1, "complaint": 1, "payment pending": 2, "unpaid": 2}


class SerpError(Exception):
    pass


SEARCH_TTL = 6 * 3600


def available():
    return bool(os.getenv("SERPAPI_KEY"))


def _search(q, recent="m"):
    """Google results via SerpAPI. `recent`: d/w/m/y limits to the past day/week/month/year.
    Google ignores `num` since Sept 2025, so each call returns ~10 results. Cached for 6h."""
    key = os.getenv("SERPAPI_KEY")
    if not key:
        raise SerpError("SERPAPI_KEY not set in backend/.env")
    params = {"engine": "google", "q": q, "gl": "in", "hl": "en", "google_domain": "google.co.in",
              "location": "India"}
    if recent:
        params["tbs"] = f"qdr:{recent}"
    ck = "serp:" + repr(sorted(params.items()))
    hit = db.cache_get(ck, SEARCH_TTL)
    if hit is not None:
        return hit
    try:
        r = httpx.get("https://serpapi.com/search.json", timeout=40, params={**params, "api_key": key})
    except httpx.HTTPError as e:
        raise SerpError(f"SerpAPI unreachable: {e}")
    if r.status_code != 200:
        raise SerpError(f"SerpAPI {r.status_code}: {r.text[:200]}")
    res = r.json().get("organic_results", [])
    db.cache_set(ck, res)
    return res


def _kind(url):
    return "government" if sources.is_official(url) else "private/aggregator"


def _org(text):
    m = ORG_RE.search(text or "")
    return m.group(1).strip() if m else ""


def profile_terms(company, limit=4):
    """Short product/service phrases from the profile, e.g. ['desktop computers', 'ups', 'cctv']."""
    raw = f"{company.get('products','')},{company.get('services','')}"
    phrases = []
    for p in re.split(r"[,;\n/|]+|\band\b", raw):
        p = re.sub(r"[^\w\s\-&]", " ", p).strip().lower()
        p = " ".join(p.split()[:3])
        if len(p) > 2 and p not in phrases:
            phrases.append(p)
    return phrases[:limit]


def or_terms(phrases):
    return "(" + " OR ".join(f'"{p}"' if " " in p else p for p in phrases) + ")"


def find_tenders(company):
    """Official-site tender pages for this company's products/services, via Google (SerpAPI)."""
    phrases = profile_terms(company)
    if not phrases:
        return []
    kw = or_terms(phrases)
    state = company.get("state", "")
    central = " OR ".join(f"site:{s}" for s in ("gem.gov.in", "eprocure.gov.in", "etenders.gov.in"))
    queries = [
        f"({central}) {kw} tender OR bid",
        f'{kw} tender ("bid end date" OR "bid submission" OR "last date") filetype:pdf site:gov.in',
        f"{kw} (tender OR NIT OR RFP) site:gov.in OR site:nic.in",
    ]
    sp = sources.state_portal(state)
    if sp:
        queries.append(f"site:{sp} {kw} tender")
    elif state:
        queries.append(f"{kw} tender {state} site:gov.in")
    seen, out, errors = set(), [], []
    for q in queries:
        try:
            results = _search(q)
        except SerpError as e:
            errors.append(str(e))
            continue
        for r in results:
            link = r.get("link")
            if not link or link in seen or not sources.is_official(link):
                continue
            if not sources.looks_like_tender(link, r.get("title", ""), r.get("snippet", "")):
                continue
            seen.add(link)
            text = f"{r.get('title','')} {r.get('snippet','')}"
            out.append({"title": r.get("title", ""), "link": link, "snippet": r.get("snippet", ""),
                        "source": sources.portal_name(link), "kind": "government", "org": _org(text),
                        "found_via": "SerpAPI"})
    if not out and errors and len(errors) == len(queries):
        raise SerpError(errors[0])
    return out


def intel_queries(title, org):
    subject = org or title
    return subject, [f'"{subject}" tender awarded bidders L1 contract',
                     f'"{subject}" blacklisted OR arbitration OR dispute OR delay OR cancelled tender payment']


def tender_intel(title, org, extra_hits=None):
    """Buyer risk + competitors from public search results. `extra_hits` lets other search
    APIs (You.com) add results in the same {title, link, snippet} shape."""
    subject, qs = intel_queries(title, org)
    hits = list(extra_hits or [])
    for q in qs:
        try:
            hits += _search(q, recent="")
        except SerpError:
            pass
    hits = list({h.get("link"): h for h in hits if h.get("link")}.values())
    if not hits:
        raise SerpError("No search results (check SERPAPI_KEY / YDC_API_KEY and quota)")
    risk_score, flags, comp, offers = 0, [], collections.Counter(), []
    for h in hits:
        text = f"{h.get('title','')}. {h.get('snippet','')}"
        low = text.lower()
        for w, wt in RISK_WORDS.items():
            if w in low:
                risk_score += wt
                flags.append({"signal": w, "source": h.get("link"), "text": text[:220]})
        for m in COMP_RE.findall(text):
            name = m.strip()
            if subject.lower() in name.lower() or any(a in name.lower() for a in AGGREGATORS):
                continue
            comp[name] += 1
        for amt in AMOUNT_RE.findall(text):
            offers.append({"amount": amt.strip(), "context": text[:200], "source": h.get("link")})
    level = "High" if risk_score >= 8 else "Medium" if risk_score >= 3 else "Low"
    return {"subject": subject, "risk_level": level, "risk_score": risk_score,
            "flags": flags[:8],
            "competitors": [{"name": n, "mentions": c} for n, c in comp.most_common(8)],
            "past_offers": offers[:8],
            "note": "Best-effort from public search snippets. Verify on the official portal "
                    "(award/L1 data) before relying on it."}
