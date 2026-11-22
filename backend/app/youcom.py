"""You.com APIs: Search (find tender pages) and Extract (read full page / PDF as Markdown).

Docs: https://you.com/docs/api-reference/search.md , .../extract.md
All endpoints: POST https://ydc-index.io/v1/<name>, header X-API-Key.
"""
import os
import httpx
from . import db

BASE = "https://ydc-index.io/v1"
SEARCH_TTL = 6 * 3600       # tender listings change daily; 6h keeps demos cheap
EXTRACT_TTL = 3 * 24 * 3600  # a published tender page rarely changes


class YouError(Exception):
    def __init__(self, msg, code="", retryable=False):
        super().__init__(msg)
        self.code, self.retryable = code, retryable


def _key():
    k = os.getenv("YDC_API_KEY") or os.getenv("YOU_API_KEY")
    if not k:
        raise YouError("YDC_API_KEY not set in backend/.env", "no_key")
    return k


def _post(path, body, timeout):
    try:
        r = httpx.post(f"{BASE}/{path}", json=body, timeout=timeout,
                       headers={"X-API-Key": _key(), "Content-Type": "application/json"})
    except httpx.HTTPError as e:
        raise YouError(f"You.com unreachable: {e}", "network", True)
    if r.status_code == 200:
        return r.json()
    try:
        data = r.json()
    except ValueError:
        data = {}
    err = data.get("error") if isinstance(data.get("error"), dict) else {}
    msg = err.get("message") or data.get("message") or data.get("detail") or data.get("error") or r.text[:200]
    raise YouError(f"You.com {r.status_code}: {msg}", err.get("code", str(r.status_code)),
                   bool(err.get("retryable")) or r.status_code in (503, 504))


def available():
    return bool(os.getenv("YDC_API_KEY") or os.getenv("YOU_API_KEY"))


def search(query, count=20, domains=None, freshness="month", country="IN"):
    """Web search restricted to `domains`. Returns [{title, link, snippet, page_age}]."""
    body = {"query": query, "count": count, "country": country}
    if freshness:
        body["freshness"] = freshness
    if domains:
        body["include_domains"] = domains
    key = "you:search:" + repr(sorted(body.items()))
    hit = db.cache_get(key, SEARCH_TTL)
    if hit is not None:
        return hit
    data = _post("search", body, 40)
    out = []
    for w in (data.get("results") or {}).get("web", []) or []:
        snip = " ".join(w.get("snippets") or []) or w.get("description", "")
        out.append({"title": w.get("title", ""), "link": w.get("url", ""), "snippet": snip[:600],
                    "page_age": w.get("page_age", "")})
    db.cache_set(key, out)
    return out


def extract(url, timeout=40, parse_effort="lite"):
    """Full page or PDF as Markdown. Returns {"title", "markdown"}; markdown may be empty."""
    key = "you:extract:" + url
    hit = db.cache_get(key, EXTRACT_TTL)
    if hit is not None:
        return hit
    body = {"url": url, "full_page": {"extraction_formats": ["markdown"]},
            "timeout": timeout, "parse_effort": parse_effort}
    try:
        data = _post("extract", body, timeout + 10)
    except YouError as e:
        if e.code in ("pdf_too_large", "timeout") and timeout < 90:
            body["timeout"] = 90
            data = _post("extract", body, 100)
        else:
            raise
    md = ((data.get("contents") or {}).get("full_page") or {}).get("markdown") or ""
    out = {"title": data.get("title", ""), "markdown": md}
    if md:
        db.cache_set(key, out)
    return out
