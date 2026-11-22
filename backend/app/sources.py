"""Official government tender sources and helpers to recognise them."""
import re
from urllib.parse import urlparse

# Central portals
CENTRAL = ["gem.gov.in", "bidplus.gem.gov.in", "eprocure.gov.in", "etenders.gov.in", "defproc.gov.in"]

# State e-procurement portals (NIC GePNIC and state systems)
STATE_PORTALS = {
    "andhra pradesh": "apeprocurement.gov.in",
    "assam": "assamtenders.gov.in",
    "bihar": "eproc2.bihar.gov.in",
    "chhattisgarh": "eproc.cgstate.gov.in",
    "delhi": "govtprocurement.delhi.gov.in",
    "goa": "eprocure.goa.gov.in",
    "gujarat": "nprocure.com",
    "haryana": "etenders.hry.nic.in",
    "himachal pradesh": "hptenders.gov.in",
    "jammu and kashmir": "jktenders.gov.in",
    "jharkhand": "jharkhandtenders.gov.in",
    "karnataka": "kppp.karnataka.gov.in",
    "kerala": "etenders.kerala.gov.in",
    "madhya pradesh": "mptenders.gov.in",
    "maharashtra": "mahatenders.gov.in",
    "odisha": "tendersodisha.gov.in",
    "punjab": "eproc.punjab.gov.in",
    "rajasthan": "eproc.rajasthan.gov.in",
    "tamil nadu": "tntenders.gov.in",
    "telangana": "tender.telangana.gov.in",
    "uttar pradesh": "etender.up.nic.in",
    "uttarakhand": "uktenders.gov.in",
    "west bengal": "wbtenders.gov.in",
}

# Gujarat's official portal is the only one outside .gov.in / .nic.in
EXTRA_OFFICIAL = {"nprocure.com"}

# Portal search / listing pages (CAPTCHA-gated or JS-loaded lists, not one tender)
LISTING = re.compile(r"FrontEndLatestActiveTenders|FrontEndTendersBy|FrontEndAdvancedSearch|"
                     r"FrontEndListTenders|/all-bids\b|/advance-search\b|/latestactivetenders", re.I)

# Pages on official sites that are never a single tender
NOT_A_TENDER = re.compile(
    r"/(login|signin|register|faq|help|about|contact|sitemap|privacy|disclaimer|terms|"
    r"careers?|recruitment|vacanc|result|archive)\b", re.I)


def host(url):
    return urlparse(url).netloc.lower().split(":")[0]


def is_official(url):
    h = host(url)
    return h.endswith(".gov.in") or h.endswith(".nic.in") or h == "gov.in" or \
        any(h == d or h.endswith("." + d) for d in EXTRA_OFFICIAL)


def portal_name(url):
    h = host(url)
    if "gem.gov.in" in h:
        return "GeM"
    if h.endswith("eprocure.gov.in"):
        return "CPPP"
    if h.endswith("etenders.gov.in"):
        return "eTenders (NIC)"
    for state, d in STATE_PORTALS.items():
        if h == d or h.endswith("." + d):
            return f"{state.title()} e-Procurement"
    return h.removeprefix("www.")


def looks_like_tender(url, title="", snippet=""):
    """Drop portal homepages, search/listing pages and info pages; keep tender pages and documents."""
    path = urlparse(url).path or "/"
    if path in ("", "/") and not urlparse(url).query:
        return False
    if NOT_A_TENDER.search(path) or LISTING.search(url):
        return False
    text = f"{title} {snippet} {url}".lower()
    return any(w in text for w in ("tender", "bid", "nit", "rfp", "rfq", "e-procurement", "eoi",
                                   "expression of interest", "quotation", "procurement", ".pdf"))


def state_portal(state):
    return STATE_PORTALS.get((state or "").strip().lower())


def search_domains(state=""):
    """Domains for You.com's include_domains filter."""
    doms = CENTRAL + ["gov.in", "nic.in"]
    sp = state_portal(state)
    if sp and sp not in doms:
        doms.append(sp)
    return doms
