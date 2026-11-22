import datetime, re

ITEMS = [
    ("gst", "GST registration certificate", 6), ("pan", "Company PAN", 4),
    ("udyam", "Udyam / NSIC certificate", 6), ("iso", "ISO / quality certificates", 5),
    ("balance", "Last 3 yrs audited balance sheets", 8), ("itr", "ITR + CA turnover certificate", 6),
    ("exp", "Past work/supply orders + completion certificates", 8),
    ("solvency", "Bank solvency / ability-to-pay letter", 4),
    ("dsc", "Class-3 Digital Signature Certificate", 6),
    ("portal", "Registered on the tender portal", 4),
    ("emd", "EMD / bid security arranged (or exemption doc)", 6),
    ("spec", "Technical specs compliance sheet", 8),
    ("price", "Price bid / BOQ prepared", 8),
    ("undertake", "Undertakings, affidavits, integrity pact", 4),
    ("authorisation", "Authorisation letter / board resolution", 3),
]


def _days_left(deadline):
    if not deadline:
        return None
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%d-%m-%y", "%d/%m/%y", "%Y-%m-%d"):
        try:
            return (datetime.datetime.strptime(deadline, fmt).date() - datetime.date.today()).days
        except ValueError:
            pass
    return None


def profile_completeness(c):
    fields = ["name", "gstin", "udyam", "state", "city", "size", "products", "certifications"]
    return sum(bool(c.get(f)) for f in fields) / len(fields) + (0 if c.get("turnover_cr") else -0.1)


def score(company, checklist, analysis, deadline):
    total_w = sum(w for _, _, w in ITEMS)
    done_w = sum(w for k, _, w in ITEMS if checklist.get(k))
    docs = 50 * done_w / total_w
    prof = 20 * max(0.0, profile_completeness(company))
    align = {"Well aligned": 20, "Partially aligned": 11, "Not aligned": 3}.get(
        (analysis or {}).get("verdict"), 8)
    days = _days_left(deadline or (analysis or {}).get("terms", {}).get("deadline"))
    if days is None:
        timing = 5
    elif days < 0:
        timing = 0
    else:
        remaining = total_w - done_w
        timing = 10 if days >= 7 or remaining < 12 else 6 if days >= 3 else 2
    sc = round(docs + prof + align + timing)
    grade = "Ready" if sc >= 80 else "Almost ready" if sc >= 60 else "Needs work" if sc >= 40 else "Not ready"
    gaps = [label for k, label, _ in ITEMS if not checklist.get(k)]
    return {"score": sc, "grade": grade, "days_left": days, "gaps": gaps,
            "breakdown": {"documents": round(docs), "profile": round(prof),
                          "alignment": align, "timing": timing}}
