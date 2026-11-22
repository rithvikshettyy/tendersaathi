import os, re, collections
from urllib.parse import urlparse
import httpx

GOV_SITES = ["gem.gov.in", "eprocure.gov.in", "etenders.gov.in", "tenderdetail.com",
             "tender247.com", "nprocure.com", "mahatenders.gov.in", "tntenders.gov.in"]
PRIVATE_SITES = ["tendersontime.com", "bidassist.com", "tenderwatch.in", "indiamart.com",
                 "tradeindia.com"]
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


def _search(q, num=10):
    key = os.getenv("SERPAPI_KEY")
    if not key:
        raise SerpError("SERPAPI_KEY not set in .env")
    r = httpx.get("https://serpapi.com/search.json", timeout=40, params={
        "engine": "google", "q": q, "gl": "in", "hl": "en", "google_domain": "google.co.in",
        "location": "India", "num": num, "api_key": key})
    if r.status_code != 200:
        raise SerpError(f"SerpAPI {r.status_code}: {r.text[:200]}")
    return r.json().get("organic_results", [])


def _kind(url):
    host = urlparse(url).netloc.lower()
    if host.endswith(".gov.in") or host.endswith(".nic.in") or "gem.gov" in host:
        return "government"
    return "private/aggregator"


def _org(text):
    m = ORG_RE.search(text or "")
    return m.group(1).strip() if m else ""


def find_tenders(keywords, categories, state=""):
    kw = " ".join(keywords[:4])
    queries = []
    gov = " OR ".join(f"site:{s}" for s in GOV_SITES[:5])
    prv = " OR ".join(f"site:{s}" for s in PRIVATE_SITES[:4])
    queries.append(f"({gov}) {kw} tender")
    queries.append(f"({prv}) {kw} tender OR RFQ OR \"expression of interest\"")
    queries.append(f"{kw} tender India open bid submission last date")
    if state:
        queries.append(f"{kw} tender {state} government e-procurement")
    if categories:
        queries.append(f"{categories[0]} tender India private company vendor RFQ supplier")
    seen, out = set(), []
    for q in queries:
        try:
            results = _search(q)
        except SerpError:
            if not out:
                raise
            continue
        for r in results:
            link = r.get("link")
            if not link or link in seen:
                continue
            seen.add(link)
            text = f"{r.get('title','')} {r.get('snippet','')}"
            out.append({"title": r.get("title", ""), "link": link, "snippet": r.get("snippet", ""),
                        "source": urlparse(link).netloc, "kind": _kind(link), "org": _org(text)})
    return out


def tender_intel(title, org):
    subject = org or title
    qs = [f'"{subject}" tender awarded bidders L1 contract',
          f'"{subject}" blacklisted OR arbitration OR dispute OR delay OR cancelled tender payment']
    hits = []
    for q in qs:
        try:
            hits += _search(q, 10)
        except SerpError:
            pass
    if not hits:
        raise SerpError("No search results (check SERPAPI_KEY / quota)")
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
