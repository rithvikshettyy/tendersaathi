"""WhatsApp Cloud API helpers (ported from turf-whatsapp-bot/src/wa/send.js)."""
import hashlib, hmac, logging, os
import httpx

log = logging.getLogger("tendersaathi.wa")
MAX_LEN = 4000  # WhatsApp text limit is 4096


def _graph(path):
    return f"https://graph.facebook.com/{os.getenv('GRAPH_VERSION', 'v21.0')}/{path}"


def _auth():
    return {"Authorization": f"Bearer {os.getenv('WA_TOKEN', '')}"}


def send(payload):
    try:
        r = httpx.post(_graph(f"{os.getenv('WA_PHONE_NUMBER_ID')}/messages"), headers=_auth(),
                       json={"messaging_product": "whatsapp", **payload}, timeout=30)
        if r.status_code >= 300:
            log.error("wa_send_failed %s %s", r.status_code, r.text[:300])
        return r.status_code < 300
    except httpx.HTTPError as e:
        log.error("wa_send_error %s", e)
        return False


def send_text(to, body):
    return send({"to": to, "type": "text", "text": {"body": body[:4096]}})


def send_template(to, name, lang, params):
    return send({"to": to, "type": "template", "template": {
        "name": name, "language": {"code": lang},
        "components": [{"type": "body", "parameters": [{"type": "text", "text": str(p)} for p in params]}]}})


def download_media(media_id):
    meta = httpx.get(_graph(media_id), headers=_auth(), timeout=30)
    meta.raise_for_status()
    blob = httpx.get(meta.json()["url"], headers=_auth(), timeout=60)
    blob.raise_for_status()
    return blob.content


def verify_signature(raw_body: bytes, header: str) -> bool:
    secret = os.getenv("WA_APP_SECRET", "")
    if not secret or not header or not header.startswith("sha256="):
        return False
    want = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(want, header[7:])


def _days(it):
    d = (it.get("score_parts") or {}).get("days_left")
    return "date ?" if d is None else f"{d}d left"


def split(text, limit=MAX_LEN):
    """Split on line breaks so no message exceeds the limit."""
    parts, cur = [], ""
    for line in text.split("\n"):
        while len(line) > limit:  # a single giant line
            parts.append(line[:limit]); line = line[limit:]
        if len(cur) + len(line) + 1 > limit:
            parts.append(cur.rstrip("\n")); cur = ""
        cur += line + "\n"
    if cur.strip():
        parts.append(cur.rstrip("\n"))
    return parts


def format_digest(items, reasons, warn=""):
    if not items:
        return ["आज कोई मज़बूत मैच नहीं मिला। / No strong tender matches today."]
    why = {r["rank"]: r for r in reasons}
    lines = [f"📋 TenderSaathi: {len(items)} tenders for you today", ""]
    for it in items[:3]:
        r = why.get(it["digest_rank"], {})
        lines += [f"⭐ {it['digest_rank']}. {it['title'][:110]}",
                  f"   {it.get('org') or '-'} · {_days(it)} · score {round(it.get('score') or 0)}"]
        if r:
            lines += [f"   🇮🇳 {r['hi']}", f"   🇬🇧 {r['en']}"]
        lines.append("")
    for it in items[3:]:
        lines.append(f"{it['digest_rank']}. {it['title'][:80]} · {it.get('org') or '-'} · {_days(it)}")
    if warn:
        lines += ["", f"⚠️ {warn}"]
    lines += ["", "Reply 1–10 for a risk report · forward a tender PDF for an eligibility check"]
    return split("\n".join(lines))


if __name__ == "__main__":
    os.environ["WA_APP_SECRET"] = "s3cret"
    body = b'{"x":1}'
    good = "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
    assert verify_signature(body, good)
    assert not verify_signature(body, "sha256=" + "0" * 64)
    assert not verify_signature(body, "")
    msgs = split("\n".join(["x" * 100] * 100))
    assert len(msgs) == 3 and all(len(m) <= MAX_LEN for m in msgs)
    items = [{"digest_rank": i, "title": f"Tender {i}", "org": "Org", "score": 50,
              "score_parts": {"days_left": 9}} for i in range(1, 11)]
    out = format_digest(items, [{"rank": 1, "hi": "हिंदी", "en": "english"}])
    assert len(out) == 1 and "⭐ 1. Tender 1" in out[0] and "10. Tender 10" in out[0] and "हिंदी" in out[0]
    assert "No strong" in format_digest([], [])[0]
    print("wa self-check ok")
