"""You.com cited research on a tender's buyer (You.com sponsor track)."""
import httpx
from . import youcom


class ResearchError(Exception):
    pass


def _hits(data):
    """Accept both known response shapes: {results:{web:[...],news:[...]}} and {hits:[...]}."""
    if isinstance(data.get("results"), dict):
        return (data["results"].get("web") or []) + (data["results"].get("news") or [])
    return data.get("hits") or []


def _search(query, count=5):
    """Shared You.com client (POST /v1/search, cached). Returns hits shaped {url, title, snippets}."""
    try:
        res = youcom.search(query, count=count, freshness="")
    except youcom.YouError as e:
        raise ResearchError(str(e))
    return [{"url": h["link"], "title": h["title"], "snippets": [h["snippet"]]} for h in res]


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
