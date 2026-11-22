"""Generate 20 SAMPLE bid documents in the layout of GeM (Government e-Marketplace) bid PDFs.

These are synthetic demo/seed data for TenderSaathi. Every page carries a "SAMPLE" watermark and a
footer saying it was not issued by GeM. Bid numbers use the GEM/2026/B/99xxxxx range.

Dates are relative to the day you run this, so re-run it before a demo to keep tenders "open":
    cd backend
    pip install reportlab
    python seed/make_gem_samples.py
Output: backend/seed/gem_samples/*.pdf
"""
import datetime, os, random
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, KeepTogether

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gem_samples")
TODAY = datetime.date.today()
random.seed(42)

# --- 20 tenders: (deadline offset days, fields) -----------------------------------------------
# turnover / oem_turnover in Lakh; value and emd in rupees (0 = no EMD); goods or services.
T = [
    dict(days=16, item="Desktop Computers (Q2) , Line Interactive UPS (Q2)", qty=85, kind="goods",
         ministry="Ministry Of Railways", dept="Indian Railways", org="North Western Railway",
         office="Jaipur Division", officer="Sr. DSTE", addr="DRM Office, Power House Road, Jaipur, Rajasthan", pin="302006",
         turnover=15, oem=200, exp=3, mse=True, startup=True, value=4820000, emd=96400, pbg=3, deliv=30,
         specs=[("Processor", "Intel Core i5 (12th Gen or above) / AMD Ryzen 5"), ("RAM", "16 GB DDR4"),
                ("Storage", "512 GB NVMe SSD"), ("Monitor", "23.8 inch FHD LED"), ("UPS", "1 kVA Line Interactive, 15 min backup")],
         atc=["Warranty: 3 years comprehensive onsite warranty from date of installation.",
              "Bidder/OEM must have a functional service centre in the State of Rajasthan.",
              "OEM authorization certificate and BIS certificate (IS 13252) to be uploaded."]),
    dict(days=9, item="CCTV Surveillance System (Q3)", qty=1, kind="goods",
         ministry="Rajasthan", dept="Home Department", org="Rajasthan Police",
         office="Superintendent of Police, Jodhpur", officer="Addl. SP (HQ)", addr="Police Lines, Ratanada, Jodhpur, Rajasthan", pin="342001",
         turnover=20, oem=150, exp=3, mse=True, startup=True, value=3600000, emd=72000, pbg=5, deliv=45,
         specs=[("Cameras", "64 x 4 MP IP bullet/dome cameras, IR 30 m"), ("NVR", "64-channel NVR with 8 x 8 TB surveillance HDD"),
                ("Network", "PoE switches, CAT6 cabling, fibre backbone"), ("Display", "4 x 55 inch video wall")],
         atc=["Supply, installation, testing and commissioning at 12 police stations in Jodhpur.",
              "Warranty: 3 years onsite. ISO 9001 certified OEM.", "Site survey before bidding is advised."]),
    dict(days=12, item="LED Street Light (Q2)", qty=2400, kind="goods",
         ministry="Uttar Pradesh", dept="Urban Development Department", org="Lucknow Municipal Corporation",
         office="Electrical Department, Lalbagh", officer="Executive Engineer (Electrical)", addr="Nagar Nigam Bhawan, Lalbagh, Lucknow, Uttar Pradesh", pin="226001",
         turnover=40, oem=300, exp=3, mse=True, startup=False, value=11500000, emd=230000, pbg=3, deliv=60,
         specs=[("Wattage", "90 W"), ("Efficacy", ">= 130 lm/W"), ("Protection", "IP66, IK08"), ("Surge protection", "10 kV"),
                ("Standard", "IS 10322, BIS registered")],
         atc=["Warranty: 5 years from date of installation.", "BIS registration (IS 10322) mandatory.",
              "Bidder must have a service centre in Uttar Pradesh."]),
    dict(days=20, item="Manpower Outsourcing Services - Fixed Remuneration - Healthcare; Nursing Assistant; Skilled", qty=60, kind="services",
         ministry="Ministry Of Health And Family Welfare", dept="Department Of Health And Family Welfare", org="All India Institute Of Medical Sciences (aiims)",
         office="Bhopal", officer="Administrative Officer", addr="Saket Nagar, Bhopal, Madhya Pradesh", pin="462020",
         turnover=120, oem=None, exp=3, mse=True, startup=True, value=24000000, emd=480000, pbg=5, deliv=None,
         contract="1 Year(s)",
         specs=[("Manpower", "60 Nursing Assistants (Skilled)"), ("Shift", "3 shifts, 24x7"), ("Qualification", "ANM / GNM with 1 year experience"),
                ("Compliance", "EPF, ESIC, minimum wages as per Central Govt notification")],
         atc=["Valid labour licence and EPF/ESIC registration mandatory.", "Service provider must have an office in Madhya Pradesh."]),
    dict(days=7, item="Housekeeping Service - Office/Commercial/Institutions/ Residential; Basic Cleaning; Consumables to be provided by service provider", qty=1, kind="services",
         ministry="Ministry Of Defence", dept="Department Of Military Affairs", org="Indian Army",
         office="Station HQ Pune", officer="Station Staff Officer", addr="Station Headquarters, Pune Cantonment, Pune, Maharashtra", pin="411001",
         turnover=34, oem=None, exp=3, mse=True, startup=True, value=8500000, emd=170000, pbg=5, deliv=None,
         contract="2 Year(s)",
         specs=[("Area", "1,20,000 sq ft office and residential area"), ("Staff", "45 housekeeping staff, 3 supervisors"),
                ("Consumables", "To be provided by service provider"), ("Machinery", "Scrubber driers, vacuum cleaners")],
         atc=["Police verification of all deployed staff required.", "ISO 9001 certified service provider preferred."]),
    dict(days=14, item="Office Chair (V3) (Q2) , Steel Almirah (V2) (Q2)", qty=320, kind="goods",
         ministry="Ministry Of Finance", dept="Department Of Revenue", org="Central Board Of Indirect Taxes And Customs (cbic)",
         office="Commissionerate of GST, Chennai", officer="Assistant Commissioner (Admin)", addr="GST Bhawan, Nungambakkam, Chennai, Tamil Nadu", pin="600034",
         turnover=8, oem=50, exp=2, mse=True, startup=True, value=1860000, emd=0, pbg=0, deliv=30,
         specs=[("Chair", "Revolving high-back, mesh, BIFMA tested, 5 year warranty"), ("Almirah", "Steel, 1980 x 915 x 480 mm, 4 shelves, IS 3312"),
                ("Quantity split", "240 chairs, 80 almirahs")],
         atc=["BIS certificate for steel almirah (IS 3312).", "Delivery and installation at 4 floors of GST Bhawan."]),
    dict(days=5, item="Laptop - Notebook (Q2)", qty=110, kind="goods",
         ministry="Ministry Of Education", dept="Department Of Higher Education", org="National Institute Of Technology (nit)",
         office="Warangal", officer="Assistant Registrar (Purchase)", addr="NIT Campus, Hanamkonda, Warangal, Telangana", pin="506004",
         turnover=25, oem=500, exp=3, mse=True, startup=True, value=6200000, emd=124000, pbg=3, deliv=30,
         specs=[("Processor", "Intel Core i7 (13th Gen) / AMD Ryzen 7"), ("RAM", "16 GB"), ("Storage", "1 TB SSD"),
                ("Display", "14 inch FHD IPS"), ("Battery", ">= 8 hours")],
         atc=["Warranty: 3 years onsite.", "OEM authorization certificate mandatory.", "BIS certificate (IS 13252)."]),
    dict(days=18, item="Monthly Basis Cab & Taxi Hiring Services - SUV; 2500 km x 320 hours; Local 24*7", qty=12, kind="services",
         ministry="Ministry Of Power", dept="Central Public Sector Enterprise", org="NTPC Limited",
         office="Korba Super Thermal Power Station", officer="Manager (Admin)", addr="NTPC Township, Jamnipali, Korba, Chhattisgarh", pin="495450",
         turnover=22, oem=None, exp=2, mse=True, startup=True, value=5400000, emd=108000, pbg=3, deliv=None,
         contract="1 Year(s)",
         specs=[("Vehicle", "SUV (Toyota Innova Crysta or equivalent), not older than 2 years"), ("Count", "12 vehicles"),
                ("Usage", "2500 km / 320 hours per month"), ("Fuel", "Included in rate")],
         atc=["Commercial registration and valid permits mandatory.", "Drivers with minimum 5 years experience."]),
    dict(days=11, item="Examination Gloves (Q1) , Surgical Face Mask (Q2)", qty=500000, kind="goods",
         ministry="Ministry Of Labour And Employment", dept="Employees State Insurance Corporation (esic)", org="ESIC Hospital",
         office="Maniktala, Kolkata", officer="Medical Superintendent", addr="ESIC Hospital, Maniktala, Kolkata, West Bengal", pin="700054",
         turnover=10, oem=100, exp=1, mse=True, startup=True, value=2700000, emd=54000, pbg=3, deliv=21,
         specs=[("Gloves", "Nitrile, powder-free, IS 15354"), ("Masks", "3-ply, BFE >= 98%, IS 16289"), ("Packing", "Boxes of 100")],
         atc=["Valid drug licence / CDSCO registration where applicable.", "Shelf life of at least 80% at delivery."]),
    dict(days=25, item="Uniform Shirt and Trouser (Cotton Polyester Blended) (Q3)", qty=18000, kind="goods",
         ministry="Ministry Of Home Affairs", dept="Central Armed Police Forces", org="Central Reserve Police Force (crpf)",
         office="Group Centre, Guwahati", officer="DIG (Admin)", addr="GC CRPF, Amerigog, Guwahati, Assam", pin="781023",
         turnover=64, oem=200, exp=3, mse=True, startup=False, value=16000000, emd=320000, pbg=5, deliv=90,
         specs=[("Fabric", "67/33 polyester-cotton, 220 GSM"), ("Colour", "Disruptive pattern as per sample"), ("Sizes", "As per size chart, 6 sizes"),
                ("Testing", "NITRA / BTRA lab test report")],
         atc=["Pre-dispatch inspection by buyer.", "Manufacturer only; traders not eligible for MSE preference."]),
    dict(days=30, item="Grid Connected Rooftop Solar PV System (Q2)", qty=250, kind="goods",
         ministry="Kerala", dept="Power Department", org="Agency for New and Renewable Energy Research and Technology (ANERT)",
         office="Thiruvananthapuram", officer="Project Engineer", addr="Vikas Bhavan P.O., Thiruvananthapuram, Kerala", pin="695033",
         turnover=150, oem=500, exp=3, mse=True, startup=True, value=29000000, emd=580000, pbg=3, deliv=120,
         specs=[("Capacity", "250 kWp across 18 government buildings"), ("Modules", "Mono PERC >= 540 Wp, ALMM listed"),
                ("Inverter", "On-grid string inverters, MNRE approved"), ("Warranty", "5 years system, 25 years module performance")],
         atc=["MNRE empanelled installer preferred.", "Net-metering liaison with KSEB included.", "Service centre in Kerala mandatory."]),
    dict(days=10, item="PVC Insulated Industrial Cables for Working Voltages up to and Including 1100 V (Q2)", qty=24000, kind="goods",
         ministry="Ministry Of Coal", dept="Coal India Limited", org="Bharat Coking Coal Limited",
         office="Koyla Bhawan, Dhanbad", officer="General Manager (MM)", addr="Koyla Bhawan, Koyla Nagar, Dhanbad, Jharkhand", pin="826005",
         turnover=30, oem=300, exp=3, mse=True, startup=True, value=7400000, emd=148000, pbg=3, deliv=60,
         specs=[("Type", "3.5 core, 95 sq mm, armoured, aluminium"), ("Standard", "IS 1554 (Part 1)"), ("Length", "24,000 metres in 500 m drums")],
         atc=["BIS licence for IS 1554 mandatory.", "Type test report from CPRI/ERDA."]),
    dict(days=8, item="Repair and Overhauling Service - air conditioner; Split AC, Window AC; Yes; Buyer Premises", qty=1, kind="services",
         ministry="Ministry Of Communications", dept="Department Of Posts", org="India Post",
         office="Chief Postmaster General, Odisha Circle", officer="Assistant Director (Bldgs)", addr="Dak Bhawan, Bhubaneswar, Odisha", pin="751001",
         turnover=5, oem=None, exp=2, mse=True, startup=True, value=1250000, emd=0, pbg=3, deliv=None,
         contract="1 Year(s)",
         specs=[("Units", "140 split ACs, 35 window ACs"), ("Visits", "Quarterly preventive maintenance"), ("Response", "Breakdown attended within 24 hours")],
         atc=["Spares to be charged separately as per approved rate list.", "Local office in Bhubaneswar required."]),
    dict(days=3, item="Multifunction Machine MFM (Q2) , Toner Cartridges / Ink Cartridges / Consumables for Printers (Q2)", qty=40, kind="goods",
         ministry="Maharashtra", dept="Revenue and Forest Department", org="Office of the Collector",
         office="Collectorate, Nagpur", officer="Resident Deputy Collector", addr="Civil Lines, Nagpur, Maharashtra", pin="440001",
         turnover=4, oem=100, exp=1, mse=True, startup=True, value=980000, emd=0, pbg=0, deliv=15,
         specs=[("MFM", "A4 mono laser, print/copy/scan, 40 ppm, duplex, network"), ("Toner", "Original OEM cartridges, 2 per machine")],
         atc=["Warranty: 1 year onsite.", "Installation at 6 tehsil offices."]),
    dict(days=22, item="Security Manpower Service (Version 2.0) - Office/Commercial/Institutions/ Residential; Unarmed Security Guard", qty=180, kind="services",
         ministry="Ministry Of Ports, Shipping And Waterways", dept="Major Ports", org="Visakhapatnam Port Authority",
         office="Port Area, Visakhapatnam", officer="Chief Vigilance Officer", addr="Port Administrative Building, Visakhapatnam, Andhra Pradesh", pin="530035",
         turnover=180, oem=None, exp=5, mse=False, startup=False, value=36000000, emd=720000, pbg=5, deliv=None,
         contract="2 Year(s)",
         specs=[("Guards", "160 unarmed guards, 15 supervisors, 5 gunmen"), ("Licence", "PSARA licence for Andhra Pradesh"),
                ("Training", "Ex-servicemen preferred")],
         atc=["Valid PSARA licence mandatory.", "Minimum 5 years experience in port/industrial security."]),
    dict(days=13, item="Water Purifier (RO) (Q2) , Water Cooler (Q2)", qty=96, kind="goods",
         ministry="Ministry Of Education", dept="Department Of School Education And Literacy", org="Kendriya Vidyalaya Sangathan",
         office="Regional Office, Bengaluru", officer="Assistant Commissioner", addr="KVS RO, JC Nagar, Bengaluru, Karnataka", pin="560006",
         turnover=6, oem=100, exp=2, mse=True, startup=True, value=1420000, emd=28400, pbg=3, deliv=30,
         specs=[("RO purifier", "50 LPH, RO+UV, stainless steel tank"), ("Water cooler", "150 L storage, 40 L/hr cooling, SS 304"),
                ("Standard", "IS 16240 (RO), BEE star rated")],
         atc=["Installation at 48 Kendriya Vidyalayas in Karnataka.", "Warranty: 2 years. Service centre in Karnataka."]),
    dict(days=6, item="Fire Extinguishers (Q1) , Refilling of Fire Extinguishers", qty=600, kind="goods",
         ministry="Ministry Of Petroleum And Natural Gas", dept="Central Public Sector Enterprise", org="Indian Oil Corporation Limited",
         office="Panipat Refinery", officer="Fire & Safety Manager", addr="Panipat Refinery, Baholi, Panipat, Haryana", pin="132140",
         turnover=9, oem=100, exp=2, mse=True, startup=True, value=2100000, emd=42000, pbg=3, deliv=30,
         specs=[("Type", "ABC dry powder 9 kg, CO2 4.5 kg"), ("Standard", "IS 15683, BIS marked"), ("Refilling", "600 cylinders with hydro test")],
         atc=["BIS licence mandatory.", "Refilling at site within refinery premises."]),
    # --- already closed (to test filtering) ---
    dict(days=-4, item="Sanitary Napkin Vending Machine (Q2)", qty=150, kind="goods",
         ministry="Gujarat", dept="Health and Family Welfare Department", org="Commissionerate of Health",
         office="Ahmedabad", officer="Deputy Director (Stores)", addr="Civil Hospital Campus, Asarwa, Ahmedabad, Gujarat", pin="380016",
         turnover=10, oem=50, exp=2, mse=True, startup=True, value=2250000, emd=45000, pbg=3, deliv=45,
         specs=[("Capacity", "50 napkins"), ("Operation", "Coin and QR payment"), ("Incinerator", "Electric, 100 napkins/day")],
         atc=["Installation in 75 PHCs."]),
    dict(days=-10, item="Network Switch (Q2)", qty=60, kind="goods",
         ministry="Ministry Of Electronics And Information Technology", dept="National Informatics Centre", org="NIC",
         office="NIC HQ, New Delhi", officer="Scientist-D", addr="A-Block, CGO Complex, Lodhi Road, New Delhi, Delhi", pin="110003",
         turnover=50, oem=1000, exp=3, mse=True, startup=True, value=9600000, emd=192000, pbg=3, deliv=45,
         specs=[("Ports", "48 x 1G PoE+ with 4 x 10G SFP+"), ("Layer", "Layer 3 managed"), ("Certification", "TEC / MTCTE")],
         atc=["Make in India Class-I local supplier only."]),
    dict(days=-2, item="Tractor Trolley (Q2)", qty=40, kind="goods",
         ministry="Punjab", dept="Department of Agriculture and Farmers Welfare", org="Punjab Agricultural University",
         office="Ludhiana", officer="Estate Officer", addr="PAU Campus, Ludhiana, Punjab", pin="141004",
         turnover=30, oem=100, exp=3, mse=True, startup=False, value=6000000, emd=120000, pbg=3, deliv=60,
         specs=[("Capacity", "5 tonne, hydraulic tipping"), ("Body", "MS 3 mm sheet"), ("Tyres", "7.50-16, 8 ply")],
         atc=["Testing by CFMTTI Budni or equivalent."]),
]

# ---------- PDF building ----------
ss = getSampleStyleSheet()
P = ParagraphStyle("p", parent=ss["Normal"], fontName="Helvetica", fontSize=8.5, leading=11)
PB = ParagraphStyle("pb", parent=P, fontName="Helvetica-Bold")
H = ParagraphStyle("h", parent=P, fontName="Helvetica-Bold", fontSize=10.5, leading=14, spaceBefore=8, spaceAfter=4,
                   textColor=colors.HexColor("#1f3b70"))
TITLE = ParagraphStyle("t", parent=P, fontName="Helvetica-Bold", fontSize=15, leading=19, alignment=1)
GRID = TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#9aa5b8")),
                   ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef2f8")),
                   ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5),
                   ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)])


def kv(rows, w=(70 * mm, 110 * mm)):
    data = [[Paragraph(k, PB), Paragraph(str(v), P)] for k, v in rows if v is not None]
    t = Table(data, colWidths=w)
    t.setStyle(GRID)
    return t


def table(head, rows, widths):
    data = [[Paragraph(h, PB) for h in head]] + [[Paragraph(str(c), P) for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle(list(GRID.getCommands()) + [("BACKGROUND", (0, 1), (0, -1), colors.white),
                                                       ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dfe6f2"))]))
    return t


def dt(d, hhmm):
    return f"{d.strftime('%d-%m-%Y')} {hhmm}"


def lakh(x):
    return f"{x} Lakh (s)"


def page_deco(bid_no):
    def deco(canv, doc):
        canv.saveState()
        canv.setFont("Helvetica-Bold", 64)
        canv.setFillColor(colors.Color(0.85, 0.2, 0.2, alpha=0.10))
        canv.translate(A4[0] / 2, A4[1] / 2)
        canv.rotate(40)
        canv.drawCentredString(0, 0, "SAMPLE")
        canv.restoreState()
        canv.saveState()
        canv.setFont("Helvetica", 7)
        canv.setFillColor(colors.HexColor("#a33"))
        canv.drawString(15 * mm, 9 * mm, "SAMPLE DOCUMENT - synthetic data generated for TenderSaathi demo. Not issued by GeM. Not a real bid.")
        canv.setFillColor(colors.HexColor("#555"))
        canv.drawRightString(A4[0] - 15 * mm, 9 * mm, f"{bid_no}  |  {doc.page}")
        canv.restoreState()
    return deco


def build(i, t):
    end = TODAY + datetime.timedelta(days=t["days"])
    dated = end - datetime.timedelta(days=random.randint(18, 28))
    bid_no = f"GEM/2026/B/99{40000 + i * 137:05d}"
    hhmm = random.choice(["15:00:00", "17:00:00", "18:00:00", "11:00:00"])
    total_qty = t["qty"]
    docs = "Experience Criteria,Past Performance,Bidder Turnover,Certificate (Requested in ATC)" + \
        (",OEM Authorization Certificate,OEM Annual Turnover" if t["kind"] == "goods" else ",Additional Doc 1 (Requested in ATC)")
    s = []
    s.append(kv([("Bid Number", bid_no), ("Dated", dated.strftime("%d-%m-%Y"))], (40 * mm, 140 * mm)))
    s.append(Spacer(1, 6))
    s.append(Paragraph("Bid Document", TITLE))
    s.append(Paragraph("Bid Details", H))
    rows = [
        ("Bid End Date/Time", dt(end, hhmm)),
        ("Bid Opening Date/Time", dt(end, hhmm.replace(":00:00", ":30:00"))),
        ("Bid Offer Validity (From End Date)", f"{random.choice([90, 120, 180])} (Days)"),
        ("Ministry/State Name", t["ministry"]), ("Department Name", t["dept"]),
        ("Organisation Name", t["org"]), ("Office Name", t["office"]),
        ("Contact details of Grievance redressal", f"Buyer Email id: buyer{i + 11}.sample@example.org"),
        ("Total Quantity", total_qty), ("Item Category", t["item"]),
    ]
    if t.get("contract"):
        rows.append(("Contract Period", t["contract"]))
    rows += [
        ("Minimum Average Annual Turnover of the bidder (For 3 Years)", lakh(t["turnover"])),
        ("OEM Average Turnover (Last 3 Years)", lakh(t["oem"]) if t.get("oem") else None),
        (f"Years of Past Experience Required for same/similar {'product' if t['kind'] == 'goods' else 'service'}", f"{t['exp']} Year (s)"),
        ("Turnover eligibility criteria", "GeM verified turnover"),
        ("MSE Relaxation for Years Of Experience and Turnover", "Yes | Complete" if t["mse"] else "No"),
        ("Startup Relaxation for Years Of Experience and Turnover", "Yes | Complete" if t["startup"] else "No"),
        ("Document required from seller", docs + "<br/>*In case any bidder is seeking exemption from Experience / Turnover "
         "Criteria, the supporting documents to prove his eligibility for exemption must be uploaded for evaluation by the buyer"),
        ("Do you want to show documents uploaded by bidders to all bidders participated in bid?", "Yes"),
        ("Past Performance", "80 %" if t["kind"] == "goods" else None),
        ("Bid to RA enabled", random.choice(["Yes", "No"])),
        ("Type of Bid", "Two Packet Bid"),
        ("Time allowed for Technical Clarifications during technical evaluation", "2 Days"),
        ("Inspection Required (By Empanelled Inspection Authority / Agencies pre-registered with GeM)", random.choice(["No", "Yes"])),
        ("Estimated Bid Value", t["value"]),
        ("Evaluation Method", "Total value wise evaluation"),
        ("Arbitration Clause", "No"), ("Mediation Clause", "No"),
    ]
    s.append(kv(rows))

    if t["emd"]:
        s.append(Paragraph("EMD Detail", H))
        s.append(kv([("Advisory Bank", "State Bank of India"), ("EMD Amount", t["emd"])]))
    if t["pbg"]:
        s.append(Paragraph("ePBG Detail", H))
        s.append(kv([("Advisory Bank", "State Bank of India"), ("ePBG Percentage(%)", f"{t['pbg']:.2f}"),
                     ("Duration of ePBG required (Months).", random.choice([14, 26, 38]))]))
    s.append(Paragraph(
        "(a). EMD EXEMPTION: The bidder seeking EMD exemption, must submit the valid supporting document for the relevant "
        "category as per GeM GTC with the bid. Under MSE category, only manufacturers for goods and Service Providers for "
        "Services are eligible for exemption from EMD. Traders are excluded from the purview of this Policy.<br/>"
        "(b). EMD &amp; Performance security should be in favour of Beneficiary, wherever it is applicable.<br/>"
        f"Beneficiary : {t['officer']}, {t['org']}, {t['addr']} {t['pin']}", P))
    s.append(Paragraph("Splitting", H))
    s.append(Paragraph("Bid splitting not applied.", P))
    s.append(Paragraph("MII Purchase Preference", H))
    s.append(kv([("MII Purchase Preference", "Yes")]))
    s.append(Paragraph("MSE Purchase Preference", H))
    s.append(kv([("MSE Purchase Preference", "Yes" if t["mse"] else "No")]))

    clauses = []
    if t["mse"]:
        clauses += ['If the bidder is a Micro or Small Enterprise as per latest orders issued by Ministry of MSME, the bidder shall be '
                    'relaxed from the eligibility criteria of "Experience Criteria" and "Bidder Turnover" as defined above subject to '
                    'meeting of quality and technical specifications. The bidder seeking relaxation shall upload the supporting documents.']
    if t["startup"]:
        clauses += ['If the bidder is a DPIIT registered Startup, the bidder shall be relaxed from the eligibility criteria of '
                    '"Experience Criteria" and "Bidder Turnover" as defined above subject to their meeting of quality and technical specifications.']
    clauses += ["The minimum average annual financial turnover of the bidder during the last three financial years, ending on 31st "
                "March of the previous financial year, should be as indicated in the bid document. The turnover of the bidder shall be "
                "validated by the system based on the financial data available on the GeM portal.",
                f"Experience Criteria: The Bidder or its OEM should have regularly supplied same or similar Category "
                f"{'Products' if t['kind'] == 'goods' else 'Services'} to any Central / State Govt Organization / PSU for number of "
                "Financial years as indicated above in the bid document before the bid opening date.",
                "Preference to Make In India products (For bids &lt; 200 Crore): Preference shall be given to Class 1 local supplier as "
                "defined in public procurement (Preference to Make in India), Order 2017 as amended from time to time."]
    if t["mse"]:
        clauses.append("Purchase preference to Micro and Small Enterprises (MSEs): Purchase preference will be given to MSEs having valid "
                       "Udyam Certificate. If L-1 is not an MSE and MSE Seller(s) has / have quoted price within L-1+ 15% of margin of "
                       "purchase preference, such MSE Seller shall be given opportunity to match L-1 price and contract will be awarded "
                       "for 25% percentage of total quantity.")
    for n, c in enumerate(clauses, 1):
        s.append(Paragraph(f"{n}. {c}", P))
        s.append(Spacer(1, 2))

    s.append(Paragraph(f"{t['item'].split(' , ')[0]} ( {total_qty} {'pieces' if t['kind'] == 'goods' else 'unit'} )", H))
    s.append(Paragraph("Technical Specifications", PB))
    s.append(table(["Specification", "Values"], t["specs"], (55 * mm, 125 * mm)))
    s.append(Paragraph("Consignees/Reporting Officer and Quantity", H))
    s.append(table(["S.No.", "Consignee/Reporting Officer", "Address", "Quantity", "Delivery Days"],
                   [[1, t["officer"], f"{t['pin']},{t['addr']}", total_qty, t["deliv"] or "N/A (service)"]],
                   (12 * mm, 40 * mm, 78 * mm, 22 * mm, 28 * mm)))
    s.append(Paragraph("Buyer Added Bid Specific Terms and Conditions", H))
    atc = ["OPTION CLAUSE: The Purchaser reserves the right to increase or decrease the quantity to be ordered up to 25 percent "
           "of bid quantity at the time of placement of contract."] + t["atc"]
    for n, c in enumerate(atc, 1):
        s.append(Paragraph(f"{n}. {c}", P))
    s.append(Paragraph("Disclaimer", H))
    s.append(Paragraph(
        "The Additional Terms and Conditions (ATC) have been incorporated by the Buyer after approval of their Competent Authority. "
        "The Buyer is solely responsible for the impact of these clauses on the bidding process, its outcome, and consequences thereof. "
        "All representations / grievances pertaining to the ATC clauses shall be raised with the buyer organization directly.", P))
    s.append(Spacer(1, 4))
    s.append(Paragraph("This Bid is also governed by the General Terms and Conditions.", P))
    s.append(Spacer(1, 8))
    s.append(KeepTogether([Paragraph("---Thank You---", ParagraphStyle("ty", parent=PB, alignment=1))]))

    slug = t["item"].split(" , ")[0].split(" - ")[0].split("(")[0].strip().lower()
    slug = "".join(ch if ch.isalnum() else "-" for ch in slug).strip("-")[:40].strip("-")
    path = os.path.join(OUT, f"{i + 1:02d}-{slug}.pdf")
    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=16 * mm,
                            title=f"SAMPLE Bid Document {bid_no}", author="TenderSaathi sample generator", subject="Synthetic sample, not a real GeM bid")
    deco = page_deco(bid_no)
    doc.build(s, onFirstPage=deco, onLaterPages=deco)
    return path, bid_no, end


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".pdf"):
            os.remove(os.path.join(OUT, f))
    for i, t in enumerate(T):
        path, bid_no, end = build(i, t)
        print(f"{os.path.basename(path):55s} {bid_no}  closes {end}")
    print(f"\n{len(T)} sample bid documents in {OUT}")
