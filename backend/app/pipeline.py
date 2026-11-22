"""Find -> read -> extract -> score.

1. discover(): SerpAPI (Google) + You.com Search, official government sites only.
2. read():     You.com Extract turns each tender page / PDF into Markdown.
               Fallback: download the public page or PDF directly.
3. facts():    closing date, value, EMD, buyer, location from the text.
4. win():      0-100 win chance from eligibility, scope, preferences, location, size, timing, risk.
"""
import datetime, io, re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urldefrag
import httpx
from . import analyzer, serp, sources, youcom

UA = {"User-Agent": "Mozilla/5.0 (TenderSaathi tender reader)"}
SEP = r"[\s|:*\-–/]{0,12}"   # what sits between a label and its value in text / markdown tables
DATE = r"(\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3,9})[-/., ]+\d{2,4})"
DEADLINE_LABELS = [
    r"Bid End Date\s*/?\s*Time", r"Bid Submission End Date", r"Bid Submission Closing Date",
    r"Bid Submission Last Date", r"Last Date (?:and Time )?(?:of|for) (?:online )?(?:submission|receipt)(?: of (?:bids?|tenders?|offers?|proposals?))?",
    r"Closing Date(?: (?:and|&) Time)?(?: (?:of|for) (?:submission|bids?|tenders?))?",
    r"Due Date(?: (?:of|for) (?:submission|bids?|tenders?))?", r"Bid Due Date", r"Tender Closing Date",
    r"Submission End Date", r"Last Date",
]
VALUE_RE = re.compile(
    r"(?:Estimated Bid Value|Tender Value(?: in ₹| in Rs\.?)?|Estimated (?:Cost|Value)(?: of (?:the )?(?:work|tender|contract))?|"
    r"Approx(?:imate)? (?:Cost|Value)|ECV)" + SEP + r"(?:₹|Rs\.?|INR)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr\b|lakhs?|lacs?)?", re.I)
EMD_RE = re.compile(r"(?:EMD Amount|EMD|Earnest Money(?: Deposit)?(?: Amount)?|Bid Security(?: Amount)?)"
                    r"(?:\s*\(?\s*in\s*(?:₹|Rs\.?|INR)\s*\)?)?" + SEP + r"(?:₹|Rs\.?|INR)?\s*(\d[\d,]*(?:\.\d+)?)", re.I)
# Most specific first: GeM has Ministry > Department > Organisation > Office
ORG_LABELS = [r"Organisation Chain", r"Organi[sz]ation Name", r"Name of (?:the )?(?:Department|Organi[sz]ation)",
              r"Department Name", r"Ministry\s*/\s*State Name"]


def _labelled(text, labels):
    for lab in labels:
        m = re.search(lab + SEP + r"([^\n|]{3,140})", text, re.I)
        if m:
            v = re.sub(r"\s+", " ", m.group(1)).strip(" |*-:")
            if v:
                return v
    return ""
TITLE_RE = re.compile(r"(?:Item Category|Work Description|Tender Title|Name of (?:the )?Work|Title of (?:the )?Work|Title)"
                      + SEP + r"([^\n|]{6,220})", re.I)
BIDNO_RE = re.compile(r"\bGEM/20\d\d/[BR]/\d+\b", re.I)
TENDER_ID_RE = re.compile(r"Tender ID" + SEP + r"(20\d\d_[A-Z0-9_]+)", re.I)
PIN_RE = re.compile(r"(?:PIN\s*(?:code)?|Pincode|Pin Code)" + SEP + r"([1-8]\d{5})\b", re.I)
BLOCKED_RE = re.compile(r"enter (?:the )?captcha|captcha code|please log ?in to continue|session (?:has )?expired", re.I)
GENERIC_TITLE = re.compile(r"^\s*(GEM/20|bid document|tender document|tender details?|untitled|view tender|"
                           r"e-?procurement|home\b|index)", re.I)


class PipelineError(Exception):
    pass


# ---------- 1. discover ----------

def _norm(link):
    return urldefrag(link)[0].rstrip("/")


def _youcom_find(company):
    phrases = serp.profile_terms(company)
    if not phrases or not youcom.available():
        return []
    doms = sources.search_domains(company.get("state", ""))
    kw = " OR ".join(phrases)
    qs = [f"{kw} tender bid", f"{kw} tender notice last date submission"]
    if company.get("state"):
        qs.append(f"{kw} tender {company['state']}")
    out = []
    for q in qs:
        for r in youcom.search(q, count=20, domains=doms, freshness="month"):
            link = r["link"]
            if not link or not sources.is_official(link):
                continue
            if not sources.looks_like_tender(link, r["title"], r["snippet"]):
                continue
            out.append({"title": r["title"], "link": link, "snippet": r["snippet"],
                        "source": sources.portal_name(link), "kind": "government",
                        "org": serp._org(f"{r['title']} {r['snippet']}"), "found_via": "You.com"})
    return out


def discover(company):
    if not serp.available() and not youcom.available():
        raise PipelineError("Set SERPAPI_KEY and/or YDC_API_KEY in backend/.env")
    results, errors = {}, []
    with ThreadPoolExecutor(2) as ex:
        futs = {"SerpAPI": ex.submit(serp.find_tenders, company) if serp.available() else None,
                "You.com": ex.submit(_youcom_find, company) if youcom.available() else None}
        for name, f in futs.items():
            if f is None:
                errors.append(f"{name}: key not set")
                continue
            try:
                results[name] = f.result()
            except Exception as e:  # one API failing should not sink the other
                errors.append(f"{name}: {e}")
                results[name] = []
    merged = {}
    for name in ("SerpAPI", "You.com"):
        for t in results.get(name, []):
            k = _norm(t["link"])
            if k in merged:
                if name not in merged[k]["found_via"]:
                    merged[k]["found_via"] += f" + {name}"
                if len(t["snippet"]) > len(merged[k]["snippet"]):
                    merged[k]["snippet"] = t["snippet"]
            else:
                merged[k] = dict(t)
    if not merged and len(errors) >= 2:
        raise PipelineError("; ".join(errors))
    return list(merged.values()), {"serpapi": len(results.get("SerpAPI", [])),
                                   "youcom": len(results.get("You.com", [])), "warnings": errors}


# ---------- 2. read ----------

def _strip_html(html):
    html = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d)>", "\n", html)
    html = re.sub(r"(?i)</t[dh]>", " | ", html)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", text)).strip()


def _direct(url):
    """Download a public tender page or PDF directly (fallback when You.com can't read it)."""
    with httpx.Client(timeout=30, follow_redirects=True, headers=UA) as c:
        r = c.get(url)
    if r.status_code != 200 or len(r.content) > 20_000_000:
        return ""
    if "pdf" in r.headers.get("content-type", "").lower() or r.content[:5] == b"%PDF-":
        return analyzer.pdf_text(r.content)
    return _strip_html(r.text)


def _usable(text):
    return len(text.strip()) >= 400 and not (BLOCKED_RE.search(text) and len(text) < 4000)


def read(t):
    """Returns (text, reader, note). reader: you.com | direct | snippet."""
    link, note = t["link"], ""
    if not link.startswith("http"):  # seed / manual tenders: nothing to fetch
        return f"{t.get('title','')}\n{t.get('snippet','')}", "snippet", "No online document"
    if youcom.available():
        try:
            md = youcom.extract(link)["markdown"]
            if _usable(md):
                return md, "you.com", ""
            note = "You.com returned a login/captcha page or too little text"
        except youcom.YouError as e:
            note = str(e)
    try:
        txt = _direct(link)
        if _usable(txt):
            return txt, "direct", note
    except Exception as e:
        note = note or f"Direct download failed: {e}"
    return f"{t.get('title','')}\n{t.get('snippet','')}", "snippet", note or "Page not readable"


# ---------- 3. facts ----------

def parse_date(s):
    s = re.sub(r"[/., ]+", "-", (s or "").strip()).strip("-")
    for fmt in ("%d-%m-%Y", "%d-%m-%y", "%d-%b-%Y", "%d-%B-%Y", "%d-%b-%y", "%Y-%m-%d"):
        try:
            d = datetime.datetime.strptime(s, fmt).date()
            if 2020 <= d.year <= 2035:
                return d
        except ValueError:
            pass
    return None


def find_deadline(text):
    for lab in DEADLINE_LABELS:
        for m in re.finditer(lab + r"[^\d]{0,40}?" + DATE, text, re.I):  # GeM puts the value on the next line
            d = parse_date(m.group(1))
            if d:
                return d
    return None


def _stem(w):
    return w[:-1] if len(w) > 4 and w.endswith("s") else w


def matched_terms(company, low):
    """Profile phrases (e.g. 'desktop computers') whose words all appear in the tender text."""
    words = set(_stem(w) for w in re.findall(r"[a-z0-9]+", low))
    out = []
    for p in serp.profile_terms(company, limit=10):
        toks = [_stem(w) for w in re.findall(r"[a-z0-9]+", p) if len(w) > 1]
        if toks and all(w in words for w in toks):
            out.append(p)
    return out


def _to_cr(val, unit):
    return round(analyzer._to_cr(val, unit or ""), 3)


def facts(text, company, t=None):
    t = t or {}
    f = {}
    d = find_deadline(text)
    if not d:
        d = parse_date(analyzer.extract_terms(text).get("deadline", ""))
    if not d:  # closing date already known from the source listing (GeM API, seed)
        d = parse_date((t.get("deadline") or "")[:10])
    if d:
        f["deadline"] = d.isoformat()
        f["days_left"] = (d - datetime.date.today()).days
    m = VALUE_RE.search(text)
    if m:
        try:
            v = _to_cr(float(m.group(1).replace(",", "")), m.group(2))
            if v > 0:
                f["value_cr"] = v
        except ValueError:
            pass
    if "value_cr" not in f and t.get("value_cr"):
        f["value_cr"] = t["value_cr"]
    if t.get("ext_id") and not str(t["ext_id"]).startswith("SAMPLE"):
        f.setdefault("bid_no", t["ext_id"])
    m = EMD_RE.search(text)
    if m:
        try:
            f["emd_rupees"] = float(m.group(1).replace(",", ""))
        except ValueError:
            pass
    org = _labelled(text, ORG_LABELS)
    office = _labelled(text, [r"Office Name"])
    if org and office and office.lower() not in org.lower():
        org = f"{org}, {office}"
    if org or office:
        f["org"] = (org or office)[:140]
    m = TITLE_RE.search(text)
    if m:
        f["title"] = re.sub(r"\s+", " ", m.group(1)).strip(" |*-:")[:220]
    m = BIDNO_RE.search(text) or BIDNO_RE.search(t.get("link", "") + " " + t.get("title", ""))
    if m:
        f["bid_no"] = m.group(0).upper()
    else:
        m = TENDER_ID_RE.search(text)
        if m:
            f["bid_no"] = m.group(1)
    m = PIN_RE.search(text)
    if m:
        f["pincode"] = m.group(1)
    low = text.lower()
    st, city = (company.get("state") or "").lower(), (company.get("city") or "").lower()
    sp = sources.state_portal(st)
    on_state_portal = bool(sp and t.get("link") and sources.host(t["link"]).endswith(sp))
    f["in_your_state"] = bool(st and st in low) or on_state_portal
    hits = matched_terms(company, low)
    if hits:
        f["matched_terms"] = hits
    f["in_your_city"] = bool(city and len(city) > 2 and city in low)
    f["mse_preference"] = bool(re.search(r"MSE Purchase Preference" + SEP + r"Yes", text, re.I))
    return f


# ---------- 4. win chance ----------

def win(company, analysis, f, reader="you.com", kind="government", intel=None):
    reasons, score = [], 0

    def r(level, msg):
        reasons.append({"level": level, "msg": msg})

    days = f.get("days_left")
    if days is not None and days < 0:
        return {"score": 0, "label": "Closed", "status": "closed",
                "reasons": [{"level": "red", "msg": f"Closed on {f['deadline']}"}]}

    flags = [x for x in (analysis or {}).get("flags", []) if not x["msg"].startswith("Scope match")]
    reds = sum(x["level"] == "red" for x in flags)
    ambers = sum(x["level"] == "amber" for x in flags)
    elig = max(0, 40 - 15 * reds - 4 * ambers)
    score += elig
    if reds:
        r("red", f"{reds} eligibility rule(s) you don't meet")
    elif ambers:
        r("amber", f"Eligibility mostly met, {ambers} point(s) to check")
    else:
        r("green", "You meet the eligibility rules found")

    # A tender rarely covers everything a company sells, so one full product match counts as strong.
    scope = (analysis or {}).get("scope_match_pct", 0)
    hits = f.get("matched_terms") or []
    if hits:
        scope = max(scope, min(100, 70 + 15 * (len(hits) - 1)))
    score += round(0.3 * scope)
    if hits:
        r("green" if scope >= 50 else "amber", f"Matches what you sell: {', '.join(hits[:4])}")
    else:
        r("green" if scope >= 50 else "amber" if scope >= 20 else "red", f"Scope match {scope}% with your products/services")

    terms = (analysis or {}).get("terms", {})
    small = company.get("size") in ("micro", "small")
    if small and (terms.get("mse_relaxation") or f.get("mse_preference")):
        score += 6
        r("green", "MSE preference / relaxation applies to you")
    if company.get("startup") and terms.get("startup_relaxation"):
        score += 4
        r("green", "Startup relaxation applies to you")

    if f.get("in_your_city"):
        score += 8
        r("green", f"Work/delivery in {company.get('city')}")
    elif f.get("in_your_state"):
        score += 8
        r("green", f"Buyer or delivery in {company.get('state')}")
    else:
        score += 3

    val, turn = f.get("value_cr"), company.get("turnover_cr") or 0
    if val and turn:
        ratio = val / turn
        if ratio <= 0.5:
            score += 10
            r("green", f"Size fits: ₹{val} Cr vs your ₹{turn} Cr turnover")
        elif ratio <= 1:
            score += 6
            r("amber", f"Large for you: ₹{val} Cr is {int(ratio*100)}% of your turnover")
        elif ratio <= 2:
            score += 2
            r("amber", f"Very large: ₹{val} Cr is {ratio:.1f}× your turnover")
        else:
            score -= 5
            r("red", f"Too large: ₹{val} Cr is {ratio:.1f}× your turnover")
    else:
        score += 5

    if days is None:
        score -= 8
        status = "unverified"
        r("amber", "Closing date not found. Verify on the portal")
    else:
        status = "active"
        if days < 3:
            score -= 10
            r("amber", f"Only {days} day(s) left")
        else:
            score += 2
            r("green", f"{days} days left to prepare")

    if reader == "snippet":
        score -= 10
        r("amber", "Full tender not readable; scored from the search summary")
    if kind != "government":
        score -= 10

    if intel:
        if intel.get("risk_level") == "High":
            score -= 12
            r("red", "High-risk buyer signals (disputes, delays, blacklisting)")
        elif intel.get("risk_level") == "Medium":
            score -= 5
            r("amber", "Some buyer risk signals")
        n = len(intel.get("competitors") or [])
        if n >= 5:
            score -= 4
            r("amber", f"Crowded: {n} competitors seen in similar tenders")

    # Word overlap alone is noisy (GeM boilerplate says "performance security", "service provider"...),
    # so a tender that names none of your products/services can't rank above Low.
    if not hits and scope < 50:
        score = min(score, 35)
        r("red", "Doesn't clearly match what you sell")
    score = max(0, min(100, score))
    label = "High" if score >= 70 else "Medium" if score >= 45 else "Low"
    return {"score": score, "label": label, "status": status, "reasons": reasons}


# ---------- full run for one tender ----------

def assess(t, company, text, reader, note="", intel=None):
    """Everything we store for a tender after reading it."""
    analysis = analyzer.match_profile(text, company)
    f = facts(text, company, t)
    w = win(company, analysis, f, reader, t.get("kind", "government"), intel)
    if reader == "snippet" and not f.get("bid_no") and not f.get("deadline"):
        w["status"] = "unreadable"  # portal listing / login page, not a single tender
    title = t.get("title", "")
    if f.get("title") and (not title or len(title) < 15 or GENERIC_TITLE.search(title)):
        title = f["title"]
    return {"title": title, "org": t.get("org") or f.get("org", ""), "deadline": f.get("deadline", t.get("deadline") or ""),
            "doc_text": text[:200000], "analysis": analysis, "facts": f, "win": w,
            "win_score": w["score"], "status": w["status"], "reader": reader,
            "read_status": "done" if reader != "snippet" else "limited", "note": note}


def process(rows, company, workers=4):
    def one(t):
        text, reader, note = read(t)
        return t["id"], assess(t, company, text, reader, note, t.get("intel"))
    with ThreadPoolExecutor(workers) as ex:
        return list(ex.map(one, rows))
