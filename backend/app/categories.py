import re

CATEGORIES = {
    "Electrical & Electronics": "electrical electronic cable wire transformer switchgear panel led lighting battery inverter motor pcb sensor meter circuit",
    "Civil & Construction": "civil construction cement steel bricks road bridge building concrete paving tiles plumbing scaffolding earthwork",
    "IT & Software": "software it hardware computer server network website app cloud cyber erp laptop printer cctv data",
    "Textiles & Apparel": "textile fabric garment apparel uniform yarn cotton cloth hosiery stitching knitting",
    "Food & Agro": "food agro rice wheat spice grain dairy fruit vegetable fertilizer seed pesticide packaged edible oil tea",
    "Medical & Pharma": "medical pharma medicine drug surgical hospital diagnostic syringe mask equipment ayurvedic reagent",
    "Machinery & Engineering": "machinery machine engineering fabrication pump valve bearing tool casting forging cnc welding fasteners gear",
    "Chemicals & Plastics": "chemical plastic polymer paint resin adhesive rubber pvc hdpe pipes solvent",
    "Furniture & Stationery": "furniture stationery paper desk chair almirah notebook file office supplies",
    "Printing & Packaging": "printing packaging carton box label corrugated pouch bag flexo offset",
    "Solar & Renewable": "solar renewable panel photovoltaic wind biogas ev charging energy storage",
    "Transport & Logistics": "transport logistics vehicle truck bus cab warehouse courier freight fleet ambulance",
    "Housekeeping & Security Services": "housekeeping security manpower cleaning facility guard sanitation catering maintenance outsourcing",
    "Consulting & Training": "consulting training survey audit design architect research skill education",
}


def tokens(text):
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def categorize(products, services):
    toks = set(tokens(f"{products} {services}"))
    scored = []
    for cat, kws in CATEGORIES.items():
        hits = len(toks & set(kws.split()))
        if hits:
            scored.append((hits, cat))
    scored.sort(reverse=True)
    return [c for _, c in scored[:3]] or ["General Supplies"]


def tender_category(text):
    return categorize(text, "")[0]
