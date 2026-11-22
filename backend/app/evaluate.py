"""Score tenders against the company profile, pick the daily 10, explain the best 3."""
import datetime, json, logging, os, re
import httpx
from . import db
from .analyzer import STOP
from .categories import tokens, tender_category
from .readiness import _days_left

log = logging.getLogger("tendersaathi.evaluate")
DIGEST_SIZE, BEST = 10, 3
# Words in almost every tender title; they carry no product signal.
GENERIC = set("supply procurement installation annual rate contract services service purchase "
              "tender bids various items office offices district department".split())


def _meaningful(text):
    return {w for w in tokens(text) if len(w) > 3 and w not in STOP and w not in GENERIC}


def score(t, company):
    """Returns (total 0-100, parts) or (None, parts) when the tender must be excluded."""
    title_toks = _meaningful(t["title"])
    prof_toks = _meaningful(f"{company['products']} {company['services']}")
    share = len(title_toks & prof_toks) / max(1, len(title_toks))
    cat = t.get("category") or tender_category(t["title"])
    cat_hit = cat in company.get("categories", [])
    if share == 0 and not cat_hit:
        return None, {"excluded": "no product overlap"}
    match = min(60, round(50 * share) + (10 if cat_hit else 0))

    days = _days_left(t.get("deadline") or "")
    if days is not None and days < 3:
        return None, {"days_left": days, "excluded": "closes in under 3 days"}
    deadline = 8 if days is None else 25 if days >= 7 else 10

    turnover, value = company.get("turnover_cr") or 0, t.get("value_cr")
    if value is None or not turnover:
        size, ratio = 7, None
    else:
        ratio = value / turnover
        size = 15 if ratio <= 2 else 7 if ratio <= 5 else 0
    parts = {"match": match, "match_pct": round(share * 100), "deadline": deadline, "days_left": days,
             "size": size, "value_to_turnover": round(ratio, 1) if ratio is not None else None}
    return match + deadline + size, parts


def _stored(day):
    with db.conn() as c:
        d = c.execute("SELECT * FROM digests WHERE day=?", (day,)).fetchone()
        if not d:
            return None
        ids = json.loads(d["tender_ids"])
        rows = {r["id"]: dict(r) for r in c.execute(
            f"SELECT * FROM tenders WHERE id IN ({','.join('?' * len(ids))})", ids)} if ids else {}
    items = [rows[i] for i in ids if i in rows]
    for it in items:
        it["score_parts"] = json.loads(it.get("score_parts") or "{}")
    return {"items": items, "reasons": json.loads(d["reasons"] or "[]")}


def pick(company, day=None, with_reasons=True):
    """Idempotent per day: a second call returns the stored digest, never a new pick."""
    day = day or datetime.date.today().isoformat()
    found = _stored(day)
    if found:
        return found
    with db.conn() as c:
        rows = [dict(r) for r in c.execute(
            "SELECT * FROM tenders WHERE company_id=? AND sent_on IS NULL", (company["id"],))]
    scored = []
    for t in rows:
        total, parts = score(t, company)
        if total is not None:
            scored.append((total, t, parts))
    scored.sort(key=lambda x: (-x[0], x[1]["id"]))
    top = scored[:DIGEST_SIZE]
    items = []
    for rank, (total, t, parts) in enumerate(top, 1):
        items.append({**t, "score": total, "score_parts": parts, "digest_rank": rank})
    reasons = make_reasons(items[:BEST], company) if (with_reasons and items) else []
    with db.conn() as c:  # one transaction: ranks + digest row land together
        for it in items:
            c.execute("UPDATE tenders SET score=?, score_parts=?, sent_on=?, digest_rank=? WHERE id=?",
                      (it["score"], json.dumps(it["score_parts"]), day, it["digest_rank"], it["id"]))
        c.execute("INSERT OR IGNORE INTO digests VALUES(?,?,?)",
                  (day, json.dumps([it["id"] for it in items]), json.dumps(reasons)))
    return _stored(day)


def _fallback_reason(it):
    p = it["score_parts"]
    days = "unknown" if p["days_left"] is None else p["days_left"]
    days_hi = "पता नहीं" if p["days_left"] is None else p["days_left"]
    return {"rank": it["digest_rank"],
            "en": f"{p['match_pct']}% of the title matches your products; {days} days left.",
            "hi": f"शीर्षक का {p['match_pct']}% आपके उत्पादों से मेल खाता है; {days_hi} दिन बाकी।"}


def make_reasons(best, company):
    """One Sarvam call for hi + en reasons; template fallback if the call or JSON fails."""
    key = os.getenv("SARVAM_API_KEY")
    fallback = [_fallback_reason(it) for it in best]
    if not key:
        return fallback
    facts = [{"rank": it["digest_rank"], "title": it["title"], "org": it["org"], **it["score_parts"]}
             for it in best]
    prompt = ("You explain why a tender suits an Indian small business. Use ONLY these facts. "
              f"Company products: {company['products']}. Turnover: {company['turnover_cr']} Cr.\n"
              f"Facts: {json.dumps(facts, ensure_ascii=False)}\n"
              'Return ONLY a JSON array: [{"rank": n, "en": "<one short sentence>", '
              '"hi": "<same sentence in Hindi>"}]')
    try:
        r = httpx.post("https://api.sarvam.ai/v1/chat/completions", timeout=45,
                       headers={"api-subscription-key": key, "Content-Type": "application/json"},
                       json={"model": "sarvam-m", "temperature": 0.2,
                             "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        text = re.sub(r"<think>.*?</think>", "", r.json()["choices"][0]["message"]["content"], flags=re.S)
        out = json.loads(re.search(r"\[.*\]", text, re.S).group(0))
        by_rank = {o["rank"]: o for o in out if o.get("en") and o.get("hi")}
        return [by_rank.get(f["rank"], f) for f in fallback]
    except Exception as e:  # noqa: BLE001 - reasons are optional decoration
        log.warning("reasons fallback: %s", e)
        return fallback


if __name__ == "__main__":
    import tempfile
    db.DB_PATH = os.path.join(tempfile.mkdtemp(), "t.db")
    db.init()
    co = {"id": 1, "products": "steel furniture office chairs almirah", "services": "",
          "turnover_cr": 2.0, "categories": ["Furniture & Stationery"]}
    soon = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    later = (datetime.date.today() + datetime.timedelta(days=10)).isoformat()
    with db.conn() as c:
        for title, dl, val in [("Supply of steel almirah and office chairs", later, 0.5),
                               ("Supply of steel almirah", soon, 0.5),
                               ("Supply of office chairs rate contract", later, 40.0),
                               ("Supply of LED street lights", later, 0.5)]:
            c.execute("INSERT INTO tenders(company_id,title,link,org,deadline,value_cr) VALUES(1,?,?,?,?,?)",
                      (title, title, "Org", dl, val))
    t = lambda title, dl, val: {"title": title, "deadline": dl, "value_cr": val}
    assert score(t("Supply of steel almirah", soon, 0.5), co)[0] is None, "closing tomorrow must be excluded"
    best, _ = score(t("Supply of steel almirah and office chairs", later, 0.5), co)
    big, _ = score(t("Supply of office chairs rate contract", later, 40.0), co)
    assert best > big and best <= 100
    d1 = pick(co, "2026-01-01", with_reasons=False)
    d2 = pick(co, "2026-01-01", with_reasons=False)
    ids = [i["id"] for i in d1["items"]]
    assert ids == [i["id"] for i in d2["items"]], "second pick must be identical"
    assert score(t("Supply of LED street lights", later, 0.5), co)[0] is None, "zero overlap must be excluded"
    assert len(ids) == 2 and d1["items"][0]["title"].startswith("Supply of steel almirah and"), ids
    assert all(i["digest_rank"] == n for n, i in enumerate(d1["items"], 1))
    print("evaluate self-check ok")
