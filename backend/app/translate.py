"""Site-wide UI translation with Sarvam (same chat model as the assistant: sarvam-105b-conversations).

Strings are translated in batches (one model call returns a JSON array) and cached per string+language
in the api_cache table, so each UI string is paid for once.
"""
import hashlib, json, os, re, threading, time
from concurrent.futures import ThreadPoolExecutor
import httpx
from . import db
from .rag import LANGS

MODEL = "sarvam-105b-conversations"
URL = "https://api.sarvam.ai/v1/chat/completions"
TTL = 90 * 24 * 3600
MAX_TEXTS, MAX_CHARS = 200, 600          # per request from the browser
BATCH_ITEMS, BATCH_CHARS = 40, 2500      # per model call
# Uncached strings one visitor (IP) may send per window: stops anyone burning Sarvam credits.
RATE_STRINGS, RATE_WINDOW = 1500, 600


class TranslateError(Exception):
    pass


_rate, _rate_lock = {}, threading.Lock()


def allow(ip, n):
    now = time.time()
    with _rate_lock:
        used, start = _rate.get(ip, (0, now))
        if now - start > RATE_WINDOW:
            used, start = 0, now
        if used + n > RATE_STRINGS:
            return False
        _rate[ip] = (used + n, start)
        return True


def _key(lang, s):
    return f"tr:{lang}:{hashlib.sha1(s.encode('utf-8')).hexdigest()}"


def _call(batch, lang):
    key = os.getenv("SARVAM_API_KEY")
    if not key:
        raise TranslateError("SARVAM_API_KEY not set")
    system = (
        f"You translate website UI text from English to {LANGS[lang]}. "
        "You get a JSON array of strings. Return ONLY a JSON array with the same number of strings, in the same order, "
        "each translated. Keep these unchanged: numbers, amounts (₹, Rs, Lakh, Cr), dates, percentages, IDs like "
        "GEM/2026/B/123, URLs, emails, and the names TenderSaathi, GeM, CPPP, SerpAPI, You.com, Sarvam, Udyam, GSTIN, "
        "EMD, MSE, MSME, DPIIT, PDF, AI. Keep short labels short. No explanations.")
    r = httpx.post(URL, timeout=90, headers={"api-subscription-key": key, "Content-Type": "application/json"},
                   json={"model": MODEL, "temperature": 0.1,
                         "messages": [{"role": "system", "content": system},
                                      {"role": "user", "content": json.dumps(batch, ensure_ascii=False)}]})
    if r.status_code != 200:
        raise TranslateError(f"Sarvam {r.status_code}: {r.text[:160]}")
    text = re.sub(r"<think>.*?</think>", "", r.json()["choices"][0]["message"]["content"], flags=re.S)
    m = re.search(r"\[.*\]", text, re.S)
    out = json.loads(m.group(0)) if m else None
    if not isinstance(out, list) or len(out) != len(batch) or not all(isinstance(x, str) for x in out):
        raise TranslateError("Model returned a malformed list")
    return [o.strip() or b for o, b in zip(out, batch)]


def _batches(items):
    cur, size = [], 0
    for s in items:
        if cur and (len(cur) >= BATCH_ITEMS or size + len(s) > BATCH_CHARS):
            yield cur
            cur, size = [], 0
        cur.append(s)
        size += len(s)
    if cur:
        yield cur


def translate(texts, lang, ip="?"):
    """Returns {"translations": [...same order...], "missing": n}. Untranslatable strings come back unchanged."""
    if lang == "en" or lang not in LANGS:
        return {"translations": list(texts), "missing": 0}
    out, todo = {}, []
    for s in dict.fromkeys(texts):
        hit = db.cache_get(_key(lang, s), TTL)
        if hit is not None:
            out[s] = hit
        else:
            todo.append(s)
    missing = 0
    if todo:
        if not allow(ip, len(todo)):
            raise TranslateError("Translation limit reached, try again in a few minutes")
        batches = list(_batches(todo))

        def attempt(b):
            try:
                return _call(b, lang)
            except Exception:  # noqa: BLE001
                return None

        def run(b):
            """One bad batch: retry once in halves, keep whichever half works, leave the rest in English."""
            res = attempt(b)
            if res is not None or len(b) == 1:
                return [(b, res)]
            half = len(b) // 2
            return [(b[:half], attempt(b[:half])), (b[half:], attempt(b[half:]))]

        with ThreadPoolExecutor(4) as ex:
            for parts in ex.map(run, batches):
                for b, res in parts:
                    if res is None:
                        missing += len(b)
                        continue
                    for s, t in zip(b, res):
                        out[s] = t
                        db.cache_set(_key(lang, s), t)
    return {"translations": [out.get(s, s) for s in texts], "missing": missing}
