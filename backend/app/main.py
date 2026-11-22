import datetime, json, logging, re, secrets, os
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Header, HTTPException, UploadFile, File, BackgroundTasks, Request
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel

load_dotenv()
from . import db, categories, serp, analyzer, schemes, readiness, rag, supabase_auth  # noqa: E402
from . import ingest, evaluate, research, wa, tts  # noqa: E402

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


def _tender_out(t):
    for k in ("analysis", "intel", "checklist", "score_parts"):
        t[k] = json.loads(t[k]) if t.get(k) else None
    t.pop("doc_text", None)
    return t


PDF_TOP = 5  # bid PDFs downloaded and checked per search; each is ~100 KB and 1-3 s


def _rank(t, u, analysis=None):
    """Title/deadline/size score, minus 10 per red eligibility flag from the bid PDF."""
    total, parts = evaluate.score(t, u)
    if total is not None and analysis:
        reds = sum(f["level"] == "red" for f in analysis["flags"])
        parts = {**parts, "red_flags": reds, "verdict": analysis["verdict"]}
        total = max(0, total - 10 * reds)
    return total, parts


@app.post("/api/tenders/search")
def search_tenders(u=Depends(me)):
    if not ingest.gem_keywords(u):
        raise HTTPException(400, "Add products/services to your profile first")
    found, errors = [], []
    try:
        found += ingest.fetch_gem(u)
    except Exception as e:  # noqa: BLE001 - GeM down must not hide SerpAPI results
        errors.append(f"GeM: {str(e)[:160]}")
    if os.getenv("SERP_LIVE", "1") == "1":
        try:
            found += ingest.fetch_serp(u)
        except serp.SerpError as e:
            errors.append(f"SerpAPI: {str(e)[:160]}")
    if not found and errors:
        raise HTTPException(502, "; ".join(errors))
    added, kept = 0, []
    with db.conn() as c:
        for t in found:
            t["category"] = categories.tender_category(f"{t['title']} {t.get('snippet', '')}")
            total, parts = _rank(t, u)
            if total is None:  # no product overlap or closing in < 3 days
                continue
            added += ingest._upsert(c, u["id"], t)
            row = c.execute("SELECT id, analysis FROM tenders WHERE company_id=? AND link=?",
                            (u["id"], t["link"])).fetchone()
            c.execute("UPDATE tenders SET score=?, score_parts=? WHERE id=?", (total, json.dumps(parts), row["id"]))
            kept.append((total, row["id"], t, bool(row["analysis"])))
    kept.sort(key=lambda k: -k[0])
    analyzed = 0
    for _, tid, t, done in [k for k in kept if k[2]["source"] == "bidplus.gem.gov.in"][:PDF_TOP]:
        if done:
            continue
        text = ingest.fetch_pdf_text(t["link"])
        if len(text.strip()) < 50:
            continue
        res = analyzer.match_profile(text, u)
        terms = res["terms"]
        value = terms.get("estimated_value_rupees")
        t = {**t, "value_cr": value / 1e7 if value else None}
        total, parts = _rank(t, u, res)
        with db.conn() as c:
            c.execute("""UPDATE tenders SET doc_text=?, analysis=?, score=?, score_parts=?, value_cr=?,
                         org=COALESCE(NULLIF(?, ''), org) WHERE id=?""",
                      (text[:200000], json.dumps(res), total, json.dumps(parts), t["value_cr"],
                       terms.get("organisation", ""), tid))
        analyzed += 1
    return {"found": len(found), "matched": len(kept), "new": added, "pdf_checked": analyzed, "errors": errors}


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
        rows = c.execute("SELECT * FROM tenders WHERE company_id=? ORDER BY score IS NULL, score DESC, id DESC",
                         (u["id"],)).fetchall()
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


class TTSIn(BaseModel):
    text: str
    lang: str = "en"


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
MENU = [("menu_today", "📋 Today's tenders"), ("menu_best", "🏆 Which to bid?"), ("menu_pdf", "📄 Check a PDF")]


def send_menu(to):
    return wa.send_buttons(to, "Namaste 🙏 I'm TenderSaathi. What do you want to do?\n\n"
                               "📋 See today's matching tenders\n🏆 Get my bid / no-bid pick\n"
                               "📄 Send a tender PDF and I'll tell you if you should bid", MENU)


def send_picker(to, items):
    if items:
        wa.send_list(to, "Tap a tender for its risk report and bid / no-bid call.", "Pick a tender",
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


def run_best():
    """Bid / no-bid call on today's top 3, from match score (no extra API spend)."""
    to = os.getenv("OWNER_PHONE", "")
    try:
        d, _ = _digest(db.owner())
        items = sorted(d["items"], key=lambda i: -(i.get("score") or 0))[:3]
        if not items:
            return wa.send_text(to, "No strong tender matches today, so nothing worth bidding on yet.")
        lines = ["🏆 My picks for you today", ""]
        for i in items:
            lines += [f"{i['digest_rank']}. {i['title'][:100]}",
                      f"   {i.get('org') or '-'} · {wa._days(i)} · score {round(i.get('score') or 0)}",
                      f"   {wa.bid_call(i.get('score'))}", ""]
        lines.append("Tap a tender below for a full risk check before you bid.")
        wa.send_text(to, "\n".join(lines))
        send_picker(to, d["items"])
    except Exception as e:  # noqa: BLE001
        log.exception("best failed")
        wa.send_text(to, f"Couldn't pick tenders: {str(e)[:200]}")


def run_digest(force_text=False):
    to, co = os.getenv("OWNER_PHONE", ""), db.owner()
    try:
        d, warn = _digest(co)
        if force_text or _window_open():
            for m in wa.format_digest(d["items"], d["reasons"], warn):
                wa.send_text(to, m)
            send_picker(to, d["items"])
        else:
            wa.send_template(to, "daily_tenders", os.getenv("TEMPLATE_LANG", "en"), [len(d["items"])])
    except Exception as e:  # noqa: BLE001 - always tell the owner instead of failing silently
        log.exception("digest failed")
        wa.send_text(to, f"Digest failed: {str(e)[:200]}")


@app.post("/api/digest/run", status_code=202)
def digest_run(bg: BackgroundTasks, x_cron_secret: str = Header("")):
    want = os.getenv("CRON_SECRET", "")
    if not want or not secrets.compare_digest(x_cron_secret, want):
        raise HTTPException(403, "Bad cron secret")
    bg.add_task(run_digest)
    return {"queued": True}


def _drill(item):
    lines = [f"🔎 {item['digest_rank']}. {item['title'][:120]}", f"Buyer: {item.get('org') or '-'}", ""]
    risk = None
    try:
        intel = serp.tender_intel(item["title"], item.get("org") or "")
        risk = intel["risk_level"]
        lines.append(f"Risk: {intel['risk_level']} (score {intel['risk_score']})")
        for f in intel["flags"][:3]:
            lines.append(f"• {f['signal']}: {f['source']}")
        if intel["competitors"]:
            lines.append("Likely competitors: " + ", ".join(c["name"] for c in intel["competitors"][:3]))
    except serp.SerpError as e:
        lines.append(f"Risk signals unavailable ({str(e)[:80]})")
    try:
        found = research.buyer_brief(item.get("org") or item["title"])
        if found:
            lines += ["", "📚 Cited research (You.com):"]
            lines += [f"• {f['title'][:90]}\n  {f['url']}" for f in found]
    except research.ResearchError as e:
        lines.append(f"Research unavailable ({str(e)[:80]})")
    lines += ["", f"👉 {wa.bid_call(item.get('score'), risk)}",
              "", "Best-effort from public sources. Verify on the official portal."]
    return "\n".join(lines)


def _eligibility(data):
    if len(data) > 10 * 1024 * 1024:
        return "PDF is over 10 MB. Please send a smaller file."
    try:
        text = analyzer.pdf_text(data)
    except Exception:  # noqa: BLE001
        return "Couldn't read that PDF."
    if len(text.strip()) < 50:
        return "No text found (scanned PDF? OCR not included)."
    res = analyzer.match_profile(text, db.owner())
    icon = {"red": "🔴", "amber": "🟠", "green": "🟢"}
    flags = sorted(res["flags"], key=lambda f: ["red", "amber", "green"].index(f["level"]))
    return "\n".join([f"📄 Eligibility: {res['verdict']} (scope match {res['scope_match_pct']}%)", ""] +
                     [f"{icon[f['level']]} {f['msg']}" for f in flags[:8]] + ["", f"👉 {wa.pdf_call(res['verdict'])}"])


def handle_message(msg):
    to = os.getenv("OWNER_PHONE", "")
    kind = msg.get("type")
    log.info("wa_msg id=%s type=%s", msg.get("id"), kind)
    if kind == "interactive":  # tap on a menu button or list row
        it = msg.get("interactive", {})
        choice = (it.get("button_reply") or it.get("list_reply") or {}).get("id", "")
        if choice == "menu_today":
            return run_digest(force_text=True)
        if choice == "menu_best":
            return run_best()
        if choice == "menu_pdf":
            return wa.send_text(to, "📄 Send or forward the tender PDF here (under 10 MB).\n"
                                    "I'll check eligibility and tell you whether to bid.")
        if choice.startswith("t_") and choice[2:].isdigit():
            return _send_drill(to, int(choice[2:]))
        return send_menu(to)
    if kind == "text":
        body = msg["text"]["body"].strip().lower()
        if re.sub(r"[^\w\s]", "", body).strip() in GREETINGS:
            return send_menu(to)
        if body in ("today", "aaj", "आज"):
            return run_digest(force_text=True)
        if body in ("bid", "best", "pick"):
            return run_best()
        if body.isdigit() and 1 <= int(body) <= evaluate.DIGEST_SIZE:
            return _send_drill(to, int(body))
        return send_menu(to)
    if kind == "document":
        doc = msg["document"]
        if doc.get("mime_type") != "application/pdf":
            return wa.send_text(to, "Please send the tender as a PDF.")
        try:
            data = wa.download_media(doc["id"])
        except Exception as e:  # noqa: BLE001
            return wa.send_text(to, f"Couldn't download the file ({str(e)[:80]}).")
        return wa.send_text(to, _eligibility(data))
    return send_menu(to)


def _send_drill(to, rank):
    d = evaluate._stored(_today())
    item = next((i for i in (d or {}).get("items", []) if i["digest_rank"] == rank), None)
    if not item:
        return wa.send_text(to, "No tender list yet today. Tap 📋 Today's tenders first.")
    wa.send_text(to, "🔎 Checking risk signals, give me a few seconds…")
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
                if _digits(msg.get("from")) != owner:
                    continue
                with db.conn() as c:  # Meta retries slow webhooks: process each message id once
                    if not c.execute("INSERT OR IGNORE INTO seen_msgs VALUES(?)", (msg["id"],)).rowcount:
                        continue
                db.kv_set("last_inbound_at", datetime.datetime.now().isoformat())
                bg.add_task(handle_message, msg)
    return {"ok": True}


@app.get("/")
def health():
    return {"status": "ok", "app": "TenderSaathi API"}
