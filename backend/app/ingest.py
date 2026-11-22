"""Daily tender ingest: SerpApi (live), GeM bid list (optional, untested), seed (always)."""
import datetime, json, logging, os, re, secrets
import httpx
from . import db, serp, categories
from .analyzer import extract_terms, pdf_text
from .evaluate import _meaningful

log = logging.getLogger("tendersaathi.ingest")
SEED_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "seed")

# A hit counts as a single tender only if it carries a bid/ref number or a date.
REF_RE = re.compile(r"GEM/\d{4}/B/\d+|tender\s*(?:id|no)|\bNIT\b|RFQ\s*No|bid\s*(?:no|number)|"
                    r"\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[- ][A-Za-z]{3}[- ]\d{4}", re.I)
LISTING_TITLE_RE = re.compile(r"tenders in |latest tenders|\d[\d,]*\+?\s+tenders|category|"
                              r"tenders? (?:list|search)", re.I)
LISTING_URL_RE = re.compile(r"/tenders?/[a-z-]+/?$", re.I)


def is_single_tender(title, snippet, link):
    if LISTING_TITLE_RE.search(title or "") or LISTING_URL_RE.search(link or ""):
        return False
    return bool(REF_RE.search(f"{title} {snippet}"))


def ensure_owner():
    """Create the single owner company from seed/profile.json if the DB is empty."""
    if db.owner():
        return db.owner()
    with open(os.path.join(SEED_DIR, "profile.json"), encoding="utf-8") as f:
        p = json.load(f)
    h, salt = db.hash_pw(secrets.token_hex(16))
    cats = categories.categorize(p["products"], p["services"])
    with db.conn() as c:
        c.execute("""INSERT INTO companies(name,email,pw_hash,salt,gstin,udyam,state,city,size,turnover_cr,
                     years,certifications,products,services,categories,women_owned,startup)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (p["name"], p["email"], h, salt, p["gstin"], p["udyam"], p["state"], p["city"], p["size"],
                   p["turnover_cr"], p["years"], p["certifications"], p["products"], p["services"],
                   json.dumps(cats), int(p["women_owned"]), int(p["startup"])))
    return db.owner()


def _upsert(c, cid, t, refresh_deadline=False):
    cat = categories.tender_category(f"{t['title']} {t.get('snippet', '')}")
    sql = """INSERT INTO tenders(company_id,title,link,snippet,source,kind,org,category,deadline,
                                 ext_id,quantity,value_cr)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT(company_id, link) DO """ + \
          ("UPDATE SET deadline=excluded.deadline" if refresh_deadline else "NOTHING")
    cur = c.execute(sql, (cid, t["title"], t["link"], t.get("snippet", ""), t["source"], t["kind"],
                          t.get("org", ""), cat, t.get("deadline", ""), t.get("ext_id"),
                          t.get("quantity"), t.get("value_cr")))
    return cur.rowcount


def load_seed(company):
    with open(os.path.join(SEED_DIR, "tenders.json"), encoding="utf-8") as f:
        rows = json.load(f)
    today = datetime.date.today()
    n = 0
    with db.conn() as c:
        for r in rows:
            # Seed stores days_from_now so it never expires.
            dl = (today + datetime.timedelta(days=r["days_from_now"])).isoformat()
            n += _upsert(c, company["id"], {**r, "deadline": dl, "link": f"seed:{r['ext_id']}",
                                            "source": "seed", "kind": "government"}, refresh_deadline=True)
    return n


def fetch_serp(company):
    out = []
    for h in serp.find_tenders(company):  # official sites only, past month, cached
        if not is_single_tender(h["title"], h["snippet"], h["link"]):
            continue
        terms = extract_terms(f"{h['title']} {h['snippet']}")
        out.append({**h, "deadline": terms.get("deadline", "")})
    return out


GEM = "https://bidplus.gem.gov.in"
GEM_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36"}


def gem_keywords(company):
    # Product words minus generic ones ("office", "supply"); one GeM search each.
    return sorted(_meaningful(f"{company['products']} {company['services']}"))[:6]


def fetch_gem(company):
    """Open GeM bids for each product keyword. Public endpoint, no login or captcha."""
    out, seen = [], set()
    with httpx.Client(timeout=30, headers=GEM_HEADERS, follow_redirects=True) as cl:
        page = cl.get(f"{GEM}/all-bids")
        # The token lives in inline JS ('csrf_bd_gem_nk': '...'), not in a form field.
        m = re.search(r"csrf_bd_gem_nk['\"]\s*[:,]\s*['\"]([0-9a-f]+)", page.text)
        if not m:
            raise RuntimeError("GeM CSRF token not found (page layout changed?)")
        for kw in gem_keywords(company):
            payload = {"page": 1, "param": {"searchBid": kw, "searchType": "fullText"},
                       "filter": {"bidStatusType": "ongoing_bids", "byType": "all", "highBidValue": "",
                                  "byEndDate": {"from": "", "to": ""}, "sort": "Bid-End-Date-Latest"}}
            r = cl.post(f"{GEM}/all-bids-data", data={"payload": json.dumps(payload), "csrf_bd_gem_nk": m.group(1)},
                        headers={"X-Requested-With": "XMLHttpRequest", "Referer": f"{GEM}/all-bids"})
            r.raise_for_status()
            for d in r.json().get("response", {}).get("response", {}).get("docs", []):
                first = lambda k: (d.get(k) or [""])[0] if isinstance(d.get(k), list) else (d.get(k) or "")
                bid = first("b_bid_number")
                if not bid or bid in seen:
                    continue
                seen.add(bid)
                out.append({"ext_id": bid, "title": first("b_category_name") or bid,
                            "org": first("ba_official_details_deptName") or first("ba_official_details_minName"),
                            "deadline": first("final_end_date_sort")[:10], "quantity": str(first("b_total_quantity")),
                            "link": f"{GEM}/showbidDocument/{first('b_id')}",
                            "snippet": f"{bid} · {first('ba_official_details_minName')}",
                            "source": "bidplus.gem.gov.in", "kind": "government"})
    return out


def fetch_pdf_text(link):
    """Download a bid PDF and return its text ('' if not a readable PDF)."""
    r = httpx.get(link, timeout=60, headers=GEM_HEADERS, follow_redirects=True)
    if r.status_code != 200 or not r.content.startswith(b"%PDF-") or len(r.content) > 10 * 1024 * 1024:
        return ""
    try:
        return pdf_text(r.content)
    except Exception:  # noqa: BLE001 - corrupt PDF means "no text", not a failed search
        return ""


def run(company):
    """Run every enabled source independently. One failing source never stops the others."""
    summary = {"serp": 0, "gem": 0, "seed": 0, "errors": [], "quota": False}
    sources = [("seed", None)]
    if os.getenv("SERP_LIVE", "1") == "1":
        sources.append(("serp", fetch_serp))
    if os.getenv("GEM_LIVE", "0") == "1":
        sources.append(("gem", fetch_gem))
    for name, fn in sources:
        try:
            if name == "seed":
                summary["seed"] = load_seed(company)
                continue
            found = fn(company)
            with db.conn() as c:
                summary[name] = sum(_upsert(c, company["id"], t) for t in found)
        except Exception as e:  # noqa: BLE001 - a source failure must not kill the digest
            msg = str(e)
            summary["errors"].append(f"{name}: {msg[:160]}")
            if name == "serp" and ("429" in msg or "run out" in msg.lower() or "quota" in msg.lower()):
                summary["quota"] = True
    log.info("ingest %s", summary)
    return summary


if __name__ == "__main__":
    assert is_single_tender("Supply of chairs GEM/2026/B/1234567", "", "https://bidplus.gem.gov.in/x")
    assert is_single_tender("Steel almirah supply", "Last date 05-12-2026", "https://x.gov.in/t/9")
    assert not is_single_tender("Furniture Tenders in Maharashtra", "Last date 05-12-2026", "https://tender247.com/a")
    assert not is_single_tender("Steel almirah supply", "Find tenders", "https://bidassist.com/tenders/furniture")
    assert not is_single_tender("Office chairs supply", "great prices", "https://x.com/p")
    print("ingest self-check ok")
