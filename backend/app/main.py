import json, secrets, os
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Header, HTTPException, UploadFile, File
from pydantic import BaseModel

load_dotenv()
from . import db, categories, serp, analyzer, schemes, readiness, rag, supabase_auth  # noqa: E402

db.init()
app = FastAPI(title="TenderSaathi")


class Profile(BaseModel):
    name: str
    gstin: str = ""
    udyam: str = ""
    state: str = ""
    city: str = ""
    size: str = "micro"
    turnover_cr: float = 0
    years: int = 0
    certifications: str = ""
    products: str = ""
    services: str = ""
    women_owned: bool = False
    startup: bool = False


class Register(Profile):
    email: str
    password: str


class Login(BaseModel):
    email: str
    password: str


class ChatIn(BaseModel):
    question: str
    lang: str = "en"
    history: list = []


class TenderIn(BaseModel):
    title: str
    link: str = ""
    org: str = ""
    deadline: str = ""


def me(authorization: Optional[str] = Header(None)):
    token = (authorization or "").replace("Bearer ", "")
    with db.conn() as c:
        r = c.execute("SELECT c.* FROM companies c JOIN sessions s ON s.company_id=c.id WHERE s.token=?",
                      (token,)).fetchone()
        if not r and supabase_auth.looks_like_jwt(token):
            try:
                u = supabase_auth.verify(token)
            except supabase_auth.SupabaseAuthError as e:
                raise HTTPException(401, str(e))
            r = c.execute("SELECT * FROM companies WHERE email=?", (u["email"],)).fetchone()
            if not r:  # first Google login: create an empty company, finished on the profile page
                cur = c.execute("INSERT INTO companies(name,email,pw_hash,salt) VALUES(?,?,?,?)",
                                (u["name"], u["email"], "", ""))
                r = c.execute("SELECT * FROM companies WHERE id=?", (cur.lastrowid,)).fetchone()
    if not r:
        raise HTTPException(401, "Not logged in")
    return db.company_public(r)


def _session(c, cid):
    t = secrets.token_hex(24)
    c.execute("INSERT INTO sessions VALUES(?,?)", (t, cid))
    return t


def _save_profile(c, cid, p: Profile):
    cats = categories.categorize(p.products, p.services)
    c.execute("""UPDATE companies SET name=?,gstin=?,udyam=?,state=?,city=?,size=?,turnover_cr=?,years=?,
                 certifications=?,products=?,services=?,categories=?,women_owned=?,startup=? WHERE id=?""",
              (p.name, p.gstin, p.udyam, p.state, p.city, p.size, p.turnover_cr, p.years, p.certifications,
               p.products, p.services, json.dumps(cats), int(p.women_owned), int(p.startup), cid))


@app.post("/api/register")
def register(p: Register):
    h, salt = db.hash_pw(p.password)
    with db.conn() as c:
        try:
            cur = c.execute("INSERT INTO companies(name,email,pw_hash,salt) VALUES(?,?,?,?)",
                            (p.name, p.email.lower(), h, salt))
        except Exception:
            raise HTTPException(400, "Email already registered")
        _save_profile(c, cur.lastrowid, p)
        return {"token": _session(c, cur.lastrowid)}


@app.post("/api/login")
def login(p: Login):
    with db.conn() as c:
        r = c.execute("SELECT * FROM companies WHERE email=?", (p.email.lower(),)).fetchone()
        if not r or db.hash_pw(p.password, r["salt"])[0] != r["pw_hash"]:
            raise HTTPException(401, "Wrong email or password")
        return {"token": _session(c, r["id"])}


@app.get("/api/me")
def get_me(u=Depends(me)):
    return u


@app.put("/api/me")
def update_me(p: Profile, u=Depends(me)):
    with db.conn() as c:
        _save_profile(c, u["id"], p)
        return db.company_public(c.execute("SELECT * FROM companies WHERE id=?", (u["id"],)).fetchone())


def _tender(c, tid, cid):
    r = c.execute("SELECT * FROM tenders WHERE id=? AND company_id=?", (tid, cid)).fetchone()
    if not r:
        raise HTTPException(404, "Tender not found")
    return dict(r)


def _tender_out(t):
    for k in ("analysis", "intel", "checklist"):
        t[k] = json.loads(t[k]) if t.get(k) else None
    t.pop("doc_text", None)
    return t


@app.post("/api/tenders/search")
def search_tenders(u=Depends(me)):
    kws = [w for w in categories.tokens(f"{u['products']} {u['services']}") if len(w) > 3][:6]
    if not kws:
        raise HTTPException(400, "Add products/services to your profile first")
    try:
        found = serp.find_tenders(kws, u["categories"], u["state"])
    except serp.SerpError as e:
        raise HTTPException(502, str(e))
    added = 0
    with db.conn() as c:
        for t in found:
            cat = categories.tender_category(t["title"] + " " + t["snippet"])
            cur = c.execute("""INSERT OR IGNORE INTO tenders(company_id,title,link,snippet,source,kind,org,category)
                               VALUES(?,?,?,?,?,?,?,?)""",
                            (u["id"], t["title"], t["link"], t["snippet"], t["source"], t["kind"], t["org"], cat))
            added += cur.rowcount
    return {"found": len(found), "new": added}


@app.post("/api/tenders")
def add_tender(t: TenderIn, u=Depends(me)):
    cat = categories.tender_category(t.title)
    with db.conn() as c:
        cur = c.execute("""INSERT INTO tenders(company_id,title,link,snippet,source,kind,org,category,deadline)
                           VALUES(?,?,?,?,?,?,?,?,?)""",
                        (u["id"], t.title, t.link or f"manual:{secrets.token_hex(6)}", "", "manual",
                         "manual", t.org, cat, t.deadline))
        return {"id": cur.lastrowid}


@app.get("/api/tenders")
def list_tenders(u=Depends(me)):
    with db.conn() as c:
        rows = c.execute("SELECT * FROM tenders WHERE company_id=? ORDER BY id DESC", (u["id"],)).fetchall()
    return [_tender_out(dict(r)) for r in rows]


@app.post("/api/tenders/{tid}/analyze")
async def analyze(tid: int, file: UploadFile = File(...), u=Depends(me)):
    data = await file.read()
    try:
        text = analyzer.pdf_text(data)
    except Exception as e:
        raise HTTPException(400, f"Cannot read PDF: {e}")
    if len(text.strip()) < 50:
        raise HTTPException(400, "No text found (scanned PDF? OCR not included)")
    result = analyzer.match_profile(text, u)
    with db.conn() as c:
        _tender(c, tid, u["id"])
        dl = result["terms"].get("deadline", "")
        c.execute("UPDATE tenders SET doc_text=?, analysis=?, deadline=CASE WHEN deadline='' OR deadline IS NULL THEN ? ELSE deadline END WHERE id=?",
                  (text[:200000], json.dumps(result), dl, tid))
    return result


@app.post("/api/tenders/{tid}/intel")
def intel(tid: int, u=Depends(me)):
    with db.conn() as c:
        t = _tender(c, tid, u["id"])
    try:
        res = serp.tender_intel(t["title"], t["org"])
    except serp.SerpError as e:
        raise HTTPException(502, str(e))
    with db.conn() as c:
        c.execute("UPDATE tenders SET intel=? WHERE id=?", (json.dumps(res), tid))
    return res


class Checklist(BaseModel):
    items: dict


@app.get("/api/tenders/{tid}/readiness")
def get_readiness(tid: int, u=Depends(me)):
    with db.conn() as c:
        t = _tender(c, tid, u["id"])
    cl = json.loads(t["checklist"] or "{}")
    an = json.loads(t["analysis"]) if t["analysis"] else None
    return {"items": [{"key": k, "label": l, "weight": w} for k, l, w in readiness.ITEMS],
            "checked": cl, **readiness.score(u, cl, an, t["deadline"])}


@app.put("/api/tenders/{tid}/readiness")
def put_readiness(tid: int, body: Checklist, u=Depends(me)):
    with db.conn() as c:
        _tender(c, tid, u["id"])
        c.execute("UPDATE tenders SET checklist=? WHERE id=?", (json.dumps(body.items), tid))
    return get_readiness(tid, u)


@app.get("/api/tenders/{tid}/fillpack")
def fillpack(tid: int, u=Depends(me)):
    """Pre-filled data for the common fields on bid/registration forms. User pastes/uploads it
    on the portal themselves: login, DSC signing and captcha stay with the user."""
    with db.conn() as c:
        t = _tender(c, tid, u["id"])
    fields = {
        "Bidder / Firm name": u["name"], "GSTIN": u["gstin"], "Udyam / NSIC no.": u["udyam"],
        "Enterprise size": u["size"], "State": u["state"], "City": u["city"],
        "Annual turnover (₹ Cr)": u["turnover_cr"], "Years in business": u["years"],
        "Certifications": u["certifications"], "Products / services offered":
            f"{u['products']}; {u['services']}".strip("; "),
        "Women-owned": "Yes" if u["women_owned"] else "No", "Startup (DPIIT)": "Yes" if u["startup"] else "No"}
    return {"tender": t["title"], "link": t["link"], "fields": fields,
            "steps": ["Open the tender link and log in to the portal with your own credentials",
                      "Copy the fields above into the matching form boxes",
                      "Attach documents from your readiness checklist (PDF, size limits per portal)",
                      "Sign with your DSC and solve the captcha yourself",
                      "Pay EMD (or upload exemption) and submit before the deadline"]}


@app.get("/api/schemes")
def get_schemes(u=Depends(me)):
    return schemes.applicable(u)


@app.get("/api/langs")
def langs():
    return rag.LANGS


@app.post("/api/chat")
def chat(body: ChatIn, u=Depends(me)):
    with db.conn() as c:
        rows = [dict(r) for r in c.execute("SELECT * FROM tenders WHERE company_id=?", (u["id"],))]
    docs = rag.build_corpus(u, rows, schemes.applicable(u))
    top = rag.bm25_top(body.question, docs, k=6)
    try:
        answer = rag.ask(body.question, top, body.lang, body.history)
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return {"answer": answer, "sources": sorted({s for s, _ in top})}


@app.get("/")
def health():
    return {"status": "ok", "app": "TenderSaathi API"}
