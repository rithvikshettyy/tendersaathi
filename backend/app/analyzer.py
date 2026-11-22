import re, io
from pypdf import PdfReader
from .categories import tokens

STOP = set("the and for with from this that are will has have not any all per its our your their".split())


def pdf_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((p.extract_text() or "") for p in reader.pages)


def _num(s):
    return float(s.replace(",", ""))


def _to_cr(val, unit):
    unit = (unit or "").lower()
    if unit.startswith("cr"):
        return val
    if unit.startswith("lakh") or unit.startswith("lac"):
        return val / 100
    if unit.startswith("million"):
        return val / 10
    return val / 1e7  # plain rupees


# GeM bid PDFs print an English label ("/EMD Amount") with its value on the next line.
GEM_BID_RE = re.compile(r"GEM/\d{4}/B/\d+")
GEM_FIELDS = {
    "deadline": r"/Bid End Date/Time\s*\n\s*(\d{2}-\d{2}-\d{4})",
    "ministry": r"/Ministry/State Name\s*\n\s*([^\n]+)",
    "department": r"/Department Name\s*\n\s*([^\n]+)",
    "organisation": r"/Organisation Name\s*\n\s*([^\n/][^\n]*)",
    "item_category": r"/Item Category\s*\n\s*([^\n]+)",
    "quantity": r"/Total Quantity\s*\n\s*(\d[\d,]*)\s*\n",
    "emd_rupees": r"/EMD Amount\s*\n\s*(\d[\d,]*)",
    "estimated_value_rupees": r"/Estimated Bid Value\s*\n\s*(\d[\d,]*)",
    "min_experience_years": r"Years of Past Experience Required for\s*\n[^\n]*\n\s*(\d{1,2})\s*Year",
    "mse_relaxation": r"MSE Relaxation for[\s\S]{0,60}?Turnover\s*\n\s*(Yes|No)",
    "startup_relaxation": r"Startup Relaxation for[\s\S]{0,60}?Turnover\s*\n\s*(Yes|No)",
}
GEM_TURNOVER_RE = re.compile(r"Turnover of the bidder[^\n]*\n[^\n]*Years\)\s*\n\s*(\d[\d.,]*)\s*(Lakh|Crore|Cr)", re.I)


def gem_terms(t):
    """Label-based fields from a GeM bid PDF; {} when the text is not a GeM bid."""
    bid = GEM_BID_RE.search(t)
    if not bid:
        return {}
    out = {"bid_number": bid.group(0)}
    for key, pat in GEM_FIELDS.items():
        m = re.search(pat, t)
        if m:
            out[key] = m.group(1).strip()
    for key in ("emd_rupees", "estimated_value_rupees"):
        if key in out:
            out[key] = _num(out[key])
    if "min_experience_years" in out:
        out["min_experience_years"] = int(out["min_experience_years"])
    for key in ("mse_relaxation", "startup_relaxation"):
        if key in out:
            out[key] = out[key] == "Yes"
    m = GEM_TURNOVER_RE.search(t)
    if m:
        out["min_turnover_cr"] = round(_to_cr(_num(m.group(1)), m.group(2)), 3)
    return out


def extract_terms(t):
    gem = gem_terms(t)
    if gem:  # GeM labels are exact; generic regexes would only add wrong numbers for these keys
        terms = _generic_terms(t)
        for k in ("emd_rupees", "min_turnover_cr", "min_experience_years", "deadline"):
            terms.pop(k, None)
        return {**terms, **gem, "source_format": "gem"}
    return _generic_terms(t)


def _generic_terms(t):
    low = t
    out = {}
    m = re.search(r"(?:EMD|earnest money(?: deposit)?)[^\d₹Rs]{0,60}(?:₹|Rs\.?|INR)?\s*(\d[\d,]*(?:\.\d+)?)", low, re.I)
    if m:
        out["emd_rupees"] = _num(m.group(1))
    m = re.search(r"(?:average annual turnover|annual turnover|turnover)[^\d₹Rs]{0,80}(?:₹|Rs\.?|INR)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crore|cr|lakhs?|lacs?|million)?", low, re.I)
    if m:
        out["min_turnover_cr"] = round(_to_cr(_num(m.group(1)), m.group(2)), 3)
    m = re.search(r"(\d{1,2})\s*(?:\+)?\s*years?[^.]{0,60}(?:experience|similar work|supplied)", low, re.I) or \
        re.search(r"experience[^.]{0,60}?(\d{1,2})\s*years?", low, re.I)
    if m:
        out["min_experience_years"] = int(m.group(1))
    m = re.search(r"(?:bid|tender)?\s*(?:submission|closing|due|last|end)\s*(?:date|end)?[^\d]{0,30}"
                  r"(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[- ][A-Za-z]{3}[- ]\d{4})", low, re.I)
    if m:
        out["deadline"] = m.group(1)
    certs = [c for c in ["ISO 9001", "ISO 14001", "ISO 45001", "BIS", "ISI", "CE mark", "NABL",
                         "GST", "PAN", "Udyam", "NSIC", "MSME", "FSSAI", "Drug licen", "BEE star"]
             if re.search(re.escape(c), low, re.I)]
    out["certifications_mentioned"] = certs
    out["mse_relaxation"] = bool(re.search(r"(MSE|MSME|micro and small)[^.]{0,80}(exempt|relax|waiv)", low, re.I))
    out["startup_relaxation"] = bool(re.search(r"startup[^.]{0,80}(exempt|relax|waiv)", low, re.I))
    out["make_in_india"] = bool(re.search(r"make in india|class[- ]i local supplier", low, re.I))
    out["oem_only"] = bool(re.search(r"\b(OEM|authori[sz]ed dealer|manufacturer only)\b", low, re.I))
    out["local_presence_required"] = bool(re.search(r"(office|service cent(?:re|er)|branch)[^.]{0,60}(in|within)\s+[A-Z][a-z]+", low))
    m = re.search(r"(?:warranty|guarantee)[^\d]{0,30}(\d{1,2})\s*(years?|months?)", low, re.I)
    if m:
        out["warranty"] = f"{m.group(1)} {m.group(2)}"
    m = re.search(r"(?:delivery|completion)\s*(?:period|time)?[^\d]{0,30}(\d{1,3})\s*(days?|weeks?|months?)", low, re.I)
    if m:
        out["delivery"] = f"{m.group(1)} {m.group(2)}"
    return out


def match_profile(text, company):
    terms = extract_terms(text)
    flags = []

    def add(level, msg):
        flags.append({"level": level, "msg": msg})

    cturn = company.get("turnover_cr") or 0
    if "min_turnover_cr" in terms:
        req = terms["min_turnover_cr"]
        small = company.get("size") in ("micro", "small")
        if cturn >= req:
            add("green", f"Turnover OK: need ~₹{req} Cr, you have ₹{cturn} Cr")
        elif small and terms["mse_relaxation"]:
            add("amber", f"Turnover short (need ₹{req} Cr) but tender mentions MSE relaxation. Claim it.")
        else:
            add("red", f"Turnover too low: need ~₹{req} Cr, you have ₹{cturn} Cr")
    else:
        add("amber", "Turnover criterion not detected. Read eligibility clause manually.")
    if "min_experience_years" in terms:
        req = terms["min_experience_years"]
        if (company.get("years") or 0) >= req:
            add("green", f"Experience OK: need {req} yrs")
        elif company.get("startup") and terms["startup_relaxation"]:
            add("amber", f"Experience short ({req} yrs) but startup relaxation mentioned")
        else:
            add("red", f"Experience short: need {req} yrs, you have {company.get('years') or 0}")
    have = (company.get("certifications") or "").lower()
    missing = [c for c in terms["certifications_mentioned"]
               if c.lower() not in have and c not in ("GST", "PAN", "Udyam", "MSME")]
    if missing:
        add("amber", "Certifications mentioned that you don't list: " + ", ".join(missing))
    elif terms["certifications_mentioned"]:
        add("green", "Listed certifications cover those mentioned")
    if terms["oem_only"]:
        add("amber", "OEM/authorised-dealer wording found. Confirm you qualify as manufacturer/authorised.")
    if terms["local_presence_required"]:
        add("amber", "Local office/service-centre requirement possible. Check location clause.")
    if terms["mse_relaxation"] and company.get("size") in ("micro", "small"):
        add("green", "MSE relaxations available to you (EMD/turnover/experience)")
    if "emd_rupees" in terms:
        add("amber" if terms["emd_rupees"] > 100000 else "green",
            f"EMD ≈ ₹{int(terms['emd_rupees']):,}" + (" (MSEs often exempt: attach Udyam/NSIC)" if company.get("size") in ("micro", "small") else ""))
    prof = set(tokens(f"{company.get('products','')} {company.get('services','')}")) - STOP
    doc = set(tokens(text))
    overlap = len(prof & doc) / max(1, len(prof))
    if overlap >= 0.5:
        add("green", f"Scope match strong ({int(overlap*100)}% of your product/service terms appear)")
    elif overlap >= 0.2:
        add("amber", f"Scope match partial ({int(overlap*100)}%). Verify item specs.")
    else:
        add("red", f"Scope match weak ({int(overlap*100)}%). Tender may not suit your products.")
    reds = sum(f["level"] == "red" for f in flags)
    ambers = sum(f["level"] == "amber" for f in flags)
    verdict = "Not aligned" if reds >= 2 or (reds and overlap < 0.2) else \
              "Partially aligned" if reds or ambers >= 3 else "Well aligned"
    return {"verdict": verdict, "scope_match_pct": int(overlap * 100), "flags": flags, "terms": terms}


if __name__ == "__main__":
    gem = ("Bid\nNumber\nGEM/2026/B/8227518\n/Bid End Date/Time\n31-12-2026 09:00:00\n/Organisation Name\nIndian Air Force\n"
           "/Minimum Average Annual\nTurnover of the bidder (For the last 3\nFinancial Years)\n17 Lakh (s)\n"
           "/Years of Past Experience Required for\nsame/similar service\n2 Year (s)\n"
           "MSE Relaxation for \nYears Of Experience\nand\nTurnover\nYes \n/EMD Amount\n174900\n2 / 16\n")
    t = extract_terms(gem)
    assert t["min_turnover_cr"] == 0.17 and t["emd_rupees"] == 174900 and t["min_experience_years"] == 2, t
    assert t["deadline"] == "31-12-2026" and t["organisation"] == "Indian Air Force" and t["mse_relaxation"], t
    assert "source_format" not in extract_terms("EMD Rs , turnover 2 crore")  # bare comma must not crash
    print("analyzer self-check ok")
