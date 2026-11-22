import datetime, hashlib, json, logging, re, secrets, os
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Header, HTTPException, UploadFile, File, BackgroundTasks, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response
from pydantic import BaseModel

load_dotenv()
from . import db, categories, serp, analyzer, schemes, readiness, rag, supabase_auth  # noqa: E402
from . import ingest, evaluate, research, wa, tts  # noqa: E402
from . import demo, pipeline, sources, stt, translate, youcom  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("tendersaathi.bot")
db.init()
ingest.load_seed(ingest.ensure_owner())  # Render disk is wiped on restart: reseed every boot
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
    if os.getenv("PUBLIC_REGISTER", "1") == "0":  # deployed: stop strangers burning SerpApi credits
        raise HTTPException(403, "Registration is closed")
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


JSON_COLS = ("analysis", "intel", "checklist", "facts", "win", "score_parts")


def _tender_out(t):
    for k in JSON_COLS:
        t[k] = json.loads(t[k]) if t.get(k) else None
    t.pop("doc_text", None)
    return t


def _rank(t, u, analysis=None):
    """Title/deadline/size score, minus 10 per red eligibility flag from the bid PDF."""
    total, parts = evaluate.score(t, u)
    if total is not None and analysis:
        reds = sum(f["level"] == "red" for f in analysis["flags"])
        parts = {**parts, "red_flags": reds, "verdict": analysis["verdict"]}
        total = max(0, total - 10 * reds)
    return total, parts


def _save_assessment(c, tid, a):
    f = a["facts"]
    c.execute("""UPDATE tenders SET title=?, org=?, deadline=?, doc_text=?, analysis=?, facts=?, win=?,
                 win_score=?, status=?, reader=?, read_status=?,
                 value_cr=COALESCE(?, value_cr), ext_id=COALESCE(ext_id, ?) WHERE id=?""",
              (a["title"], a["org"], a["deadline"], a["doc_text"], json.dumps(a["analysis"]),
               json.dumps({**f, "read_note": a["note"]}), json.dumps(a["win"]), a["win_score"],
               a["status"], a["reader"], a["read_status"], f.get("value_cr"), f.get("bid_no"), tid))


@app.post("/api/tenders/search")
def search_tenders(u=Depends(me)):
    """Step 1: find open tenders from GeM's live bid list, SerpAPI (Google) and You.com Search.
    Reading and scoring happen in /tenders/read, in small batches, so no single request runs long."""
    if not serp.profile_terms(u) and not ingest.gem_keywords(u):
        raise HTTPException(400, "Add products/services to your profile first")
    try:
        gem = ingest.fetch_gem(u)
    except Exception as e:  # noqa: BLE001 - GeM down must not hide the search APIs
        gem, warnings = [], [f"GeM: {str(e)[:160]}"]
    else:
        warnings = []
    # GeM keyword search is loose: keep bids whose title overlaps the profile and close in 3+ days.
    gem_kept = []
    for t in gem:
        t["category"] = categories.tender_category(f"{t['title']} {t.get('snippet', '')}")
        total, parts = _rank(t, u)
        if total is not None:
            gem_kept.append({**t, "found_via": "GeM", "score": total, "score_parts": parts})
    try:
        web, stats = pipeline.discover(u)
        warnings += stats["warnings"]
    except pipeline.PipelineError as e:
        web, stats = [], {"serpapi": 0, "youcom": 0}
        warnings.append(str(e))
    seen = {t["link"] for t in gem_kept}
    found = gem_kept + [t for t in web if t["link"] not in seen]
    if not found and warnings:
        raise HTTPException(502, "; ".join(warnings))
    added = 0
    with db.conn() as c:
        for t in found:
            t.setdefault("category", categories.tender_category(f"{t['title']} {t.get('snippet', '')}"))
            added += ingest._upsert(c, u["id"], t)
            c.execute("""UPDATE tenders SET found_via=CASE WHEN found_via='' OR found_via IS NULL THEN ? ELSE found_via END,
                         score=COALESCE(?, score), score_parts=COALESCE(?, score_parts)
                         WHERE company_id=? AND link=?""",
                      (t["found_via"], t.get("score"),
                       json.dumps(t["score_parts"]) if t.get("score_parts") else None, u["id"], t["link"]))
        pending = c.execute("SELECT COUNT(*) FROM tenders WHERE company_id=? AND read_status='pending'",
                            (u["id"],)).fetchone()[0]
    return {"found": len(found), "new": added, "pending": pending, "gem": len(gem_kept),
            "serpapi": stats["serpapi"], "youcom": stats["youcom"], "warnings": warnings}


@app.post("/api/tenders/read")
def read_pending(limit: int = 4, u=Depends(me)):
    """Step 2-4: read the next few unread tenders with You.com, extract terms, score win chance."""
    limit = max(1, min(limit, 8))
    with db.conn() as c:
        rows = [dict(r) for r in c.execute(
            "SELECT * FROM tenders WHERE company_id=? AND read_status='pending' ORDER BY id LIMIT ?",
            (u["id"], limit))]
    for r in rows:
        r["intel"] = json.loads(r["intel"]) if r.get("intel") else None
    results = pipeline.process(rows, u) if rows else []
    with db.conn() as c:
        for tid, a in results:
            _save_assessment(c, tid, a)
        remaining = c.execute("SELECT COUNT(*) FROM tenders WHERE company_id=? AND read_status='pending'",
                              (u["id"],)).fetchone()[0]
    return {"processed": len(results), "remaining": remaining,
            "read_by": {k: sum(a["reader"] == k for _, a in results) for k in ("you.com", "direct", "snippet")}}


@app.post("/api/tenders/{tid}/read")
def read_one(tid: int, u=Depends(me)):
    with db.conn() as c:
        t = _tender(c, tid, u["id"])
    if not t["link"].startswith("http"):
        raise HTTPException(400, "This tender has no link to read. Upload its PDF instead.")
    t["intel"] = json.loads(t["intel"]) if t.get("intel") else None
    [(_, a)] = pipeline.process([t], u, workers=1)
    with db.conn() as c:
        _save_assessment(c, tid, a)
        return _tender_out(dict(_tender(c, tid, u["id"])))


@app.post("/api/tenders/demo")
def load_demo(u=Depends(me)):
    """Load the sample GeM-format bid PDFs as tenders for this company and score them like live ones.
    Calling it again re-scores them (e.g. after a profile change)."""
    files = demo.names()
    if not files:
        raise HTTPException(404, "No sample PDFs. Run: python seed/make_gem_samples.py")
    added = 0
    with db.conn() as c:
        for name in files:
            link = demo.PREFIX + name
            text = demo.text(name)
            cur = c.execute("""INSERT OR IGNORE INTO tenders(company_id,title,link,snippet,source,kind,org,category,
                               found_via,read_status) VALUES(?,?,?,?,?,?,?,?,?,'pending')""",
                            (u["id"], name, link, "", "GeM (sample)", "government", "",
                             categories.tender_category(text[:4000]), "Sample seed"))
            added += cur.rowcount
            r = c.execute("SELECT * FROM tenders WHERE company_id=? AND link=?", (u["id"], link)).fetchone()
            t = dict(r)
            t["intel"] = json.loads(t["intel"]) if t.get("intel") else None
            t["title"] = "" if t["title"] == name else t["title"]
            a = pipeline.assess(t, u, text, "sample")
            _save_assessment(c, t["id"], a)
    return {"loaded": len(files), "new": added}


@app.get("/api/demo/pdf/{name}")
def demo_pdf(name: str):
    """Serve a sample bid PDF (public: synthetic demo data, no user data)."""
    p = demo.path(name)
    if not p:
        raise HTTPException(404, "Not found")
    return FileResponse(p, media_type="application/pdf", filename=name)


@app.post("/api/tenders")
def add_tender(t: TenderIn, u=Depends(me)):
    cat = categories.tender_category(t.title)
    has_link = t.link.startswith("http")
    with db.conn() as c:
        cur = c.execute("""INSERT INTO tenders(company_id,title,link,snippet,source,kind,org,category,deadline,
                           found_via,read_status) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                        (u["id"], t.title, t.link if has_link else f"manual:{secrets.token_hex(6)}", "",
                         sources.portal_name(t.link) if has_link else "manual",
                         ("government" if sources.is_official(t.link) else "private/aggregator") if has_link else "manual",
                         t.org, cat, t.deadline, "manual", "pending" if has_link else "manual"))
        return {"id": cur.lastrowid}


@app.get("/api/tenders")
def list_tenders(u=Depends(me)):
    """Best first: open tenders by win chance, then unverified, then unread, closed last."""
    with db.conn() as c:
        rows = c.execute("""SELECT * FROM tenders WHERE company_id=? ORDER BY
                            CASE status WHEN 'active' THEN 0 WHEN 'unverified' THEN 1 WHEN 'closed' THEN 3 ELSE 2 END,
                            win_score DESC, id DESC""", (u["id"],)).fetchall()
    return [_tender_out(dict(r)) for r in rows]


MAX_PDF = 15 * 1024 * 1024


@app.post("/api/tenders/upload")
async def upload_tender(file: UploadFile = File(...), u=Depends(me)):
    """Upload any tender PDF: it becomes a tender in your list, analysed against your profile
    (eligibility, extracted facts, win chance). Uploading the same PDF again re-analyses it."""
    data = await file.read(MAX_PDF + 1)
    if len(data) > MAX_PDF:
        raise HTTPException(413, "PDF is over 15 MB")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(400, "That file is not a PDF")
    try:
        text = analyzer.pdf_text(data)
    except Exception as e:  # noqa: BLE001 - corrupt or encrypted PDF
        raise HTTPException(400, f"Cannot read PDF: {str(e)[:120]}")
    if len(text.strip()) < 50:
        raise HTTPException(400, "No text found (scanned PDF? OCR not included)")
    link = "upload:" + hashlib.sha256(data).hexdigest()[:16]
    name = os.path.splitext(os.path.basename(file.filename or "Uploaded tender"))[0][:120]
    is_gem = bool(pipeline.BIDNO_RE.search(text))
    with db.conn() as c:
        c.execute("""INSERT OR IGNORE INTO tenders(company_id,title,link,snippet,source,kind,org,category,
                     found_via,read_status) VALUES(?,?,?,?,?,?,?,?,?,'done')""",
                  (u["id"], name, link, "", "GeM (uploaded PDF)" if is_gem else "Uploaded PDF",
                   "government" if is_gem else "manual", "", categories.tender_category(text[:4000]), "Upload"))
        t = dict(c.execute("SELECT * FROM tenders WHERE company_id=? AND link=?", (u["id"], link)).fetchone())
        t["intel"] = json.loads(t["intel"]) if t.get("intel") else None
        if t["title"] == name:
            t["title"] = ""  # let the PDF's own title (Item Category / Title of Work) win
        a = pipeline.assess(t, u, text, "upload")
        if not a["title"]:
            a["title"] = name
        _save_assessment(c, t["id"], a)
        return _tender_out(dict(_tender(c, t["id"], u["id"])))


@app.post("/api/tenders/{tid}/analyze")
async def analyze(tid: int, file: UploadFile = File(...), u=Depends(me)):
    data = await file.read()
    try:
        text = analyzer.pdf_text(data)
    except Exception as e:
        raise HTTPException(400, f"Cannot read PDF: {e}")
    if len(text.strip()) < 50:
        raise HTTPException(400, "No text found (scanned PDF? OCR not included)")
    with db.conn() as c:
        t = _tender(c, tid, u["id"])
        t["intel"] = json.loads(t["intel"]) if t.get("intel") else None
        a = pipeline.assess(t, u, text, "upload")
        _save_assessment(c, tid, a)
    return a["analysis"]


@app.post("/api/tenders/{tid}/intel")
def intel(tid: int, u=Depends(me)):
    """Buyer risk + competitors from SerpAPI (Google) and You.com Search results."""
    with db.conn() as c:
        t = _tender(c, tid, u["id"])
    extra = []
    if youcom.available():
        _, qs = serp.intel_queries(t["title"], t["org"])
        for q in qs:
            try:
                extra += youcom.search(q, count=10, freshness="")
            except youcom.YouError:
                pass
    try:
        res = serp.tender_intel(t["title"], t["org"], extra)
    except serp.SerpError as e:
        raise HTTPException(502, str(e))
    res["sources_used"] = [n for n, ok in (("SerpAPI", serp.available()), ("You.com", bool(extra))) if ok]
    with db.conn() as c:
        c.execute("UPDATE tenders SET intel=? WHERE id=?", (json.dumps(res), tid))
        if t.get("analysis"):  # re-score with buyer risk included
            f = json.loads(t["facts"]) if t.get("facts") else {}
            w = pipeline.win(u, json.loads(t["analysis"]), f, t.get("reader") or "you.com", t["kind"], res)
            c.execute("UPDATE tenders SET win=?, win_score=?, status=? WHERE id=?",
                      (json.dumps(w), w["score"], w["status"], tid))
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


class TranslateIn(BaseModel):
    lang: str
    texts: list[str]


@app.post("/api/translate")
def translate_ui(body: TranslateIn, request: Request):
    """Translate UI strings with Sarvam (public so the landing page can switch language too;
    capped per request and per visitor, cached per string)."""
    if body.lang not in rag.LANGS:
        raise HTTPException(400, "Unsupported language")
    if len(body.texts) > translate.MAX_TEXTS or any(len(t) > translate.MAX_CHARS for t in body.texts):
        raise HTTPException(413, f"Send at most {translate.MAX_TEXTS} strings of {translate.MAX_CHARS} characters")
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or \
        (request.client.host if request.client else "?")
    try:
        return translate.translate(body.texts, body.lang, ip)
    except translate.TranslateError as e:
        raise HTTPException(429 if "limit" in str(e) else 502, str(e))


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


class TTSIn(BaseModel):
    text: str
    lang: str = "en"


@app.post("/api/stt")
async def stt_endpoint(file: UploadFile = File(...), lang: str = "", u=Depends(me)):
    """Voice input for the chat: transcribe up to 30 s of audio with Sarvam (text in the spoken language)."""
    audio = await file.read(stt.MAX_BYTES + 1)
    try:
        return stt.transcribe(audio, file.filename or "speech.webm", file.content_type or "audio/webm", lang)
    except stt.STTError as e:
        raise HTTPException(e.status, str(e))


@app.post("/api/tts")
def tts_endpoint(body: TTSIn, u=Depends(me)):
    """Read a chat answer aloud (MP3)."""
    if len(body.text) > 20000:
        raise HTTPException(413, "Text too long")
    try:
        audio = tts.synthesize(body.text, body.lang)
    except tts.TTSError as e:
        raise HTTPException(e.status, str(e))
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"})


# ---------- WhatsApp bot ----------
GREETINGS = {"hi", "hii", "hiii", "hello", "hey", "heyy", "hlo", "helo", "namaste", "namaskar", "menu",
             "start", "help", "नमस्ते", "हाय", "हेलो"}
MENU = [("menu_today", "Today's tenders"), ("menu_best", "Bid recommendation"), ("menu_pdf", "Check a tender PDF")]
RETRY = "Something went wrong on our side. Please try again in a few minutes."


def send_menu(to):
    return wa.send_buttons(to, "*TenderSaathi*\nYour assistant for government tenders.\n\n"
                               "*Today's tenders:* matches for your profile\n"
                               "*Bid recommendation:* which tenders to bid on\n"
                               "*Check a tender PDF:* eligibility and a bid decision", MENU)


def send_picker(to, items):
    if items:
        wa.send_list(to, "Select a tender to view its risk report and recommendation.", "View tenders",
                     [(f"t_{i['digest_rank']}", f"{i['digest_rank']}. {i['title']}",
                       f"{i.get('org') or '-'} · {wa._days(i)}") for i in items])


def _today():
    return datetime.date.today().isoformat()


def _digits(s):
    return re.sub(r"\D", "", s or "")


def _window_open():
    last = db.kv_get("last_inbound_at")
    if not last:
        return False
    return datetime.datetime.now() - datetime.datetime.fromisoformat(last) < datetime.timedelta(hours=23)


def _digest(co):
    warn = ""
    if not evaluate._stored(_today()):  # skip ingest (and SerpApi spend) if today's digest exists
        summary = ingest.run(co)
        if summary["quota"]:
            warn = "SerpApi quota reached: today's list uses saved tenders only."
        elif summary["errors"]:
            warn = "Some live sources failed today; list may be shorter."
    d = evaluate.pick(co)
    log.info("digest day=%s items=%d warn=%s", _today(), len(d["items"]), bool(warn))
    return d, warn


def run_best(to):
    """Bid / no-bid call on today's top 3, from match score (no extra API spend)."""
    try:
        d, _ = _digest(db.owner())
        items = sorted(d["items"], key=lambda i: -(i.get("score") or 0))[:3]
        if not items:
            return wa.send_text(to, "*Bid recommendation*\nNo strong matches today, so there is nothing to bid on yet.")
        lines = ["*Bid recommendation*", "Top tenders for your profile today", ""]
        for i in items:
            lines += [f"*{i['digest_rank']}. {i['title'][:100]}*", wa.meta(i),
                      f"Recommendation: {wa.bid_call(i.get('score'))}", ""]
        lines.append("Select a tender below for a full risk report before you bid.")
        wa.send_text(to, "\n".join(lines))
        send_picker(to, d["items"])
    except Exception:  # noqa: BLE001
        log.exception("best failed")
        wa.send_text(to, RETRY)


def run_digest(force_text=False, to=None):
    to, co = to or os.getenv("OWNER_PHONE", ""), db.owner()
    try:
        d, warn = _digest(co)
        if force_text or _window_open():
            for m in wa.format_digest(d["items"], d["reasons"], warn):
                wa.send_text(to, m)
            send_picker(to, d["items"])
        else:
            wa.send_template(to, "daily_tenders", os.getenv("TEMPLATE_LANG", "en"), [len(d["items"])])
    except Exception:  # noqa: BLE001 - always tell the user instead of failing silently
        log.exception("digest failed")
        wa.send_text(to, RETRY)


@app.post("/api/digest/run", status_code=202)
def digest_run(bg: BackgroundTasks, x_cron_secret: str = Header("")):
    want = os.getenv("CRON_SECRET", "")
    if not want or not secrets.compare_digest(x_cron_secret, want):
        raise HTTPException(403, "Bad cron secret")
    bg.add_task(run_digest)
    return {"queued": True}


def _drill(item):
    lines = ["*Tender report*", f"*{item['digest_rank']}. {item['title'][:120]}*", wa.meta(item), ""]
    risk = None
    try:
        intel = serp.tender_intel(item["title"], item.get("org") or "")
        risk = intel["risk_level"]
        lines.append(f"*Risk:* {intel['risk_level']}")
        lines += [f"- {f['signal'].capitalize()}: {f['source']}" for f in intel["flags"][:3]]
        if intel["competitors"]:
            lines.append("*Likely competitors:* " + ", ".join(c["name"] for c in intel["competitors"][:3]))
    except serp.SerpError:
        log.exception("risk lookup failed")
        lines.append("*Risk:* not available right now")
    try:
        found = research.buyer_brief(item.get("org") or item["title"])
        if found:
            lines += ["", "*Sources*"]
            lines += [f"- {f['title'][:90]}\n  {f['url']}" for f in found]
    except research.ResearchError:
        log.exception("research failed")
    lines += ["", f"*Recommendation:* {wa.bid_call(item.get('score'), risk)}",
              "", "_Based on public sources. Verify details on the official portal._"]
    return "\n".join(lines)


def _eligibility(data):
    if len(data) > 10 * 1024 * 1024:
        return "This PDF is larger than 10 MB. Please send a smaller file."
    try:
        text = analyzer.pdf_text(data)
    except Exception:  # noqa: BLE001
        return "This PDF could not be read. Please check the file and send it again."
    if len(text.strip()) < 50:
        return "No readable text was found. Scanned PDFs are not supported yet; please send a text PDF."
    res = analyzer.match_profile(text, db.owner())
    lines = ["*Eligibility check*", f"Result: {res['verdict']} · Scope match {res['scope_match_pct']}%"]
    shown = 0
    for level, head in (("red", "Gaps"), ("amber", "To review"), ("green", "Met")):
        msgs = [f["msg"] for f in res["flags"] if f["level"] == level][:8 - shown]
        if msgs:
            lines += ["", f"*{head}*"] + [f"- {m}" for m in msgs]
            shown += len(msgs)
    return "\n".join(lines + ["", f"*Recommendation:* {wa.pdf_call(res['verdict'])}"])


def handle_message(msg):
    to = msg.get("from", "")  # reply to whoever wrote in
    kind = msg.get("type")
    log.info("wa_msg id=%s type=%s", msg.get("id"), kind)
    if kind == "interactive":  # tap on a menu button or list row
        it = msg.get("interactive", {})
        choice = (it.get("button_reply") or it.get("list_reply") or {}).get("id", "")
        if choice == "menu_today":
            return run_digest(force_text=True, to=to)
        if choice == "menu_best":
            return run_best(to)
        if choice == "menu_pdf":
            return wa.send_text(to, "Please send the tender document as a PDF (up to 10 MB).\n"
                                    "I will check your eligibility and recommend whether to bid.")
        if choice.startswith("t_") and choice[2:].isdigit():
            return _send_drill(to, int(choice[2:]))
        return send_menu(to)
    if kind == "text":
        body = msg["text"]["body"].strip().lower()
        if re.sub(r"[^\w\s]", "", body).strip() in GREETINGS:
            return send_menu(to)
        if body in ("today", "aaj", "आज"):
            return run_digest(force_text=True, to=to)
        if body in ("bid", "best", "pick"):
            return run_best(to)
        if body.isdigit() and 1 <= int(body) <= evaluate.DIGEST_SIZE:
            return _send_drill(to, int(body))
        return send_menu(to)
    if kind == "document":
        doc = msg["document"]
        if doc.get("mime_type") != "application/pdf":
            return wa.send_text(to, "Please send the tender document as a PDF.")
        try:
            data = wa.download_media(doc["id"])
        except Exception:  # noqa: BLE001
            log.exception("media download failed")
            return wa.send_text(to, "The file could not be downloaded. Please send it again.")
        return wa.send_text(to, _eligibility(data))
    return send_menu(to)


def _send_drill(to, rank):
    d = evaluate._stored(_today())
    item = next((i for i in (d or {}).get("items", []) if i["digest_rank"] == rank), None)
    if not item:
        return wa.send_text(to, "Today's list is not ready yet. Reply *today* to load it first.")
    wa.send_text(to, "Preparing the report. This takes a few seconds.")
    return wa.send_text(to, _drill(item))


@app.get("/webhook")
def webhook_verify(request: Request):
    q = request.query_params
    if q.get("hub.mode") == "subscribe" and q.get("hub.verify_token") == os.getenv("WA_VERIFY_TOKEN"):
        return PlainTextResponse(q.get("hub.challenge", ""))
    raise HTTPException(403, "Bad verify token")


@app.post("/webhook")
async def webhook(request: Request, bg: BackgroundTasks):
    raw = await request.body()
    if not wa.verify_signature(raw, request.headers.get("x-hub-signature-256", "")):
        raise HTTPException(403, "Bad signature")
    owner = _digits(os.getenv("OWNER_PHONE"))
    body = json.loads(raw or b"{}")
    for entry in body.get("entry", []):
        for ch in entry.get("changes", []):
            for msg in ch.get("value", {}).get("messages", []):
                with db.conn() as c:  # Meta retries slow webhooks: process each message id once
                    if not c.execute("INSERT OR IGNORE INTO seen_msgs VALUES(?)", (msg["id"],)).rowcount:
                        continue
                if _digits(msg.get("from")) == owner:  # 24h window only matters for the owner's daily digest
                    db.kv_set("last_inbound_at", datetime.datetime.now().isoformat())
                bg.add_task(handle_message, msg)
    return {"ok": True}


@app.get("/api/status")
def status():
    """Which search/read APIs are configured (no secrets returned)."""
    return {"serpapi": serp.available(), "youcom": youcom.available()}


@app.get("/")
def health():
    return {"status": "ok", "app": "TenderSaathi API"}
