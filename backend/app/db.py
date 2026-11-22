import sqlite3, os, hashlib, secrets, json, time

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "tendersaathi.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

SCHEMA = """
CREATE TABLE IF NOT EXISTS companies(
  id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, pw_hash TEXT, salt TEXT,
  gstin TEXT, udyam TEXT, state TEXT, city TEXT, size TEXT, turnover_cr REAL DEFAULT 0,
  years INTEGER DEFAULT 0, certifications TEXT DEFAULT '', products TEXT DEFAULT '',
  services TEXT DEFAULT '', categories TEXT DEFAULT '[]', women_owned INTEGER DEFAULT 0,
  startup INTEGER DEFAULT 0, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, company_id INTEGER);
CREATE TABLE IF NOT EXISTS tenders(
  id INTEGER PRIMARY KEY, company_id INTEGER, title TEXT, link TEXT, snippet TEXT,
  source TEXT, kind TEXT, org TEXT, category TEXT, deadline TEXT,
  doc_text TEXT DEFAULT '', analysis TEXT DEFAULT '', intel TEXT DEFAULT '',
  checklist TEXT DEFAULT '{}', found TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, link));
CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS seen_msgs(id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS digests(day TEXT PRIMARY KEY, tender_ids TEXT, reasons TEXT);
CREATE TABLE IF NOT EXISTS api_cache(key TEXT PRIMARY KEY, value TEXT, ts REAL);
"""
NEW_TENDER_COLS = ["ext_id TEXT", "quantity TEXT", "value_cr REAL", "score REAL",
                   "score_parts TEXT", "sent_on TEXT", "digest_rank INTEGER"]

# Columns added after the first release. ALTER TABLE ... ADD COLUMN fails if it already exists.
MIGRATIONS = [
    "ALTER TABLE tenders ADD COLUMN facts TEXT DEFAULT ''",
    "ALTER TABLE tenders ADD COLUMN win TEXT DEFAULT ''",
    "ALTER TABLE tenders ADD COLUMN status TEXT DEFAULT ''",
    "ALTER TABLE tenders ADD COLUMN win_score INTEGER DEFAULT -1",
    "ALTER TABLE tenders ADD COLUMN read_status TEXT DEFAULT 'pending'",
    "ALTER TABLE tenders ADD COLUMN reader TEXT DEFAULT ''",
    "ALTER TABLE tenders ADD COLUMN found_via TEXT DEFAULT ''",
]


def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    with conn() as c:
        c.executescript(SCHEMA)
        for m in [f"ALTER TABLE tenders ADD COLUMN {col}" for col in NEW_TENDER_COLS] + MIGRATIONS:
            try:
                c.execute(m)
            except sqlite3.OperationalError:
                pass  # column already exists


def kv_get(key):
    with conn() as c:
        r = c.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
    return r["value"] if r else None


def kv_set(key, value):
    with conn() as c:
        c.execute("INSERT OR REPLACE INTO kv VALUES(?,?)", (key, str(value)))


def owner():
    """Single-company mode: the first company is the WhatsApp owner."""
    with conn() as c:
        r = c.execute("SELECT * FROM companies ORDER BY id LIMIT 1").fetchone()
    return company_public(r) if r else None


def cache_get(key, max_age_s):
    with conn() as c:
        r = c.execute("SELECT value, ts FROM api_cache WHERE key=?", (key,)).fetchone()
    if r and time.time() - r["ts"] < max_age_s:
        return json.loads(r["value"])
    return None


def cache_set(key, value):
    with conn() as c:
        c.execute("INSERT OR REPLACE INTO api_cache VALUES(?,?,?)", (key, json.dumps(value), time.time()))


def hash_pw(pw, salt=None):
    salt = salt or secrets.token_hex(8)
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex(), salt


def row(r):
    return dict(r) if r else None


def company_public(r):
    d = dict(r)
    for k in ("pw_hash", "salt"):
        d.pop(k, None)
    d["categories"] = json.loads(d.get("categories") or "[]")
    return d
