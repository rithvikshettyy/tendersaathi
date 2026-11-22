"""You.com cited research on a tender's buyer (You.com sponsor track)."""
import os
import httpx

# shortcut: endpoint/shape not yet verified against current You.com docs; override with YDC_SEARCH_URL.
YDC_URL = os.getenv("YDC_SEARCH_URL", "https://ydc-index.io/v1/search")


class ResearchError(Exception):
    pass


def _hits(data):
    """Accept both known response shapes: {results:{web:[...],news:[...]}} and {hits:[...]}."""
    if isinstance(data.get("results"), dict):
        return (data["results"].get("web") or []) + (data["results"].get("news") or [])
    return data.get("hits") or []


def _search(query, count=5):
    key = os.getenv("YDC_API_KEY")
    if not key:
        raise ResearchError("YDC_API_KEY not set")
    r = httpx.get(YDC_URL, params={"query": query, "count": count}, headers={"X-API-Key": key}, timeout=30)
    if r.status_code != 200:
        raise ResearchError(f"You.com {r.status_code}: {r.text[:160]}")
    return _hits(r.json())


def buyer_brief(subject, limit=3):
    """Top cited findings about the buyer: payment record, past awards, recent news."""
    queries = [f"{subject} payment delay vendors tender",
               f"{subject} tender awarded contract winner",
               f"{subject} news procurement 2026"]
    seen, out = set(), []
    errors = []
    for q in queries:
        try:
            for h in _search(q):
                url = h.get("url")
                if not url or url in seen:
                    continue
                seen.add(url)
                snip = (h.get("snippets") or [h.get("description") or ""])[0]
                out.append({"title": h.get("title", ""), "url": url, "snippet": snip[:200]})
                break  # one best finding per question keeps the reply short
        except (ResearchError, httpx.HTTPError) as e:
            errors.append(str(e))
    if not out and errors:
        raise ResearchError(errors[0])
    return out[:limit]
