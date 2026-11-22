import sqlite3, os, hashlib, secrets, json

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
"""


def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    with conn() as c:
        c.executescript(SCHEMA)


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
