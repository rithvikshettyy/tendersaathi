"""Curated list of common Indian MSME / procurement schemes.
Static knowledge; rules and limits change often. Always verify on official portals."""

SCHEMES = [
    dict(name="Public Procurement Policy for MSEs", url="https://msme.gov.in",
         desc="Central ministries/PSUs must source 25% of annual purchases from MSEs (3% sub-target for women-owned).",
         when=lambda c: c["size"] in ("micro", "small")),
    dict(name="EMD & tender-fee exemption for MSEs", url="https://www.nsic.co.in",
         desc="MSEs with Udyam/NSIC registration are commonly exempt from EMD and tender fees on central tenders.",
         when=lambda c: c["size"] in ("micro", "small")),
    dict(name="Prior experience / turnover relaxation", url="https://dpiit.gov.in",
         desc="Startups (DPIIT) and MSEs can get relaxed prior-experience and turnover norms, if quality specs are met.",
         when=lambda c: c["startup"] or c["size"] in ("micro", "small")),
    dict(name="Startup India (DPIIT recognition)", url="https://www.startupindia.gov.in",
         desc="Tax benefits, easier compliance and public-procurement relaxations for recognised startups.",
         when=lambda c: c["startup"]),
    dict(name="Public Procurement (Make in India) Order", url="https://dpiit.gov.in",
         desc="Purchase preference for Class-I/II local suppliers. Get local-content certificate.",
         when=lambda c: bool(c["products"])),
    dict(name="GeM seller registration", url="https://gem.gov.in",
         desc="Government e-Marketplace: direct-buy and bid access to central/state buyers.", when=lambda c: True),
    dict(name="NSIC Single Point Registration", url="https://www.nsic.co.in",
         desc="Free tender documents, EMD exemption, marketing and raw-material assistance.",
         when=lambda c: c["size"] in ("micro", "small")),
    dict(name="CGTMSE collateral-free credit", url="https://www.cgtmse.in",
         desc="Credit guarantee for collateral-free MSE loans. Limits revised periodically.",
         when=lambda c: c["size"] in ("micro", "small", "medium")),
    dict(name="TReDS invoice discounting", url="https://www.rxil.in",
         desc="Discount invoices raised on large/government buyers to ease working capital between payments.",
         when=lambda c: c["size"] in ("micro", "small", "medium")),
    dict(name="PMEGP (new enterprises)", url="https://www.kviconline.gov.in/pmegpeportal",
         desc="Subsidised credit for new micro units in manufacturing/services.",
         when=lambda c: c["size"] == "micro" and (c["years"] or 0) < 3),
    dict(name="MSME Champions / ZED certification", url="https://zed.msme.gov.in",
         desc="Zero Defect Zero Effect certification: subsidy on certification cost and procurement preference.",
         when=lambda c: bool(c["products"])),
    dict(name="Stand-Up India / Mudra", url="https://www.standupmitra.in",
         desc="Bank loans for women and SC/ST entrepreneurs; Mudra for micro units.",
         when=lambda c: bool(c["women_owned"])),
    dict(name="Production Linked Incentive (PLI)", url="https://www.investindia.gov.in/production-linked-incentive-schemes-india",
         desc="Sector schemes: electronics, pharma, textiles, food processing, solar modules, etc.",
         when=lambda c: any(k in " ".join(c["categories"]) for k in
                            ("Electrical", "Medical", "Textiles", "Food", "Solar"))),
]


def applicable(company):
    out = []
    for s in SCHEMES:
        try:
            ok = s["when"](company)
        except Exception:
            ok = False
        out.append({"name": s["name"], "desc": s["desc"], "url": s["url"], "applicable": bool(ok)})
    out.sort(key=lambda x: not x["applicable"])
    return out
