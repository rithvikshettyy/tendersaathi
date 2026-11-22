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


def send_buttons(to, body, buttons):
    """Reply buttons: Meta allows max 3, title max 20 chars."""
    return send({"to": to, "type": "interactive", "interactive": {
        "type": "button", "body": {"text": body[:1024]},
        "action": {"buttons": [{"type": "reply", "reply": {"id": i, "title": t[:20]}} for i, t in buttons[:3]]}}})


def send_list(to, body, button, rows):
    """List picker: max 10 rows, title 24 chars, description 72 chars."""
    return send({"to": to, "type": "interactive", "interactive": {
        "type": "list", "body": {"text": body[:1024]},
        "action": {"button": button[:20], "sections": [{"title": "Tenders", "rows": [
            {"id": i, "title": t[:24], "description": d[:72]} for i, t, d in rows[:10]]}]}}})


def bid_call(score, risk_level=None):
    """Bid / no-bid from digest score (0-100) and optional public risk level."""
    if risk_level == "High":
        return "Do not bid. Public sources show high risk signals."
    if (score or 0) >= 60:
        return "Bid. Strong match with your profile."
    if (score or 0) >= 40:
        return "Consider. Moderate match; check eligibility with the tender PDF."
    return "Skip. Weak match with your profile."


def pdf_call(verdict):
    return {"Well aligned": "Bid. You meet the key conditions.",
            "Partially aligned": "Consider. Bid only if you can resolve the gaps listed above.",
            }.get(verdict, "Do not bid. Several key conditions are not met.")


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
    return "Deadline not listed" if d is None else f"{d} day{'' if d == 1 else 's'} left"


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


def meta(it):
    return f"{it.get('org') or 'Buyer not listed'} · {_days(it)} · Match {round(it.get('score') or 0)}/100"


def format_digest(items, reasons, warn=""):
    if not items:
        return ["*Today's tenders*\nNo strong matches for your profile today."]
    why = {r["rank"]: r for r in reasons}
    lines = ["*Today's tenders*", f"{len(items)} matches for your profile", ""]
    for it in items[:3]:
        r = why.get(it["digest_rank"], {})
        lines += [f"*{it['digest_rank']}. {it['title'][:110]}*", meta(it)]
        if r.get("en"):
            lines.append(f"_{r['en']}_")
        lines.append("")
    if items[3:]:
        lines.append("*Also matching*")
        lines += [f"{it['digest_rank']}. {it['title'][:80]} · {_days(it)}" for it in items[3:]]
        lines.append("")
    if warn:
        lines += [f"_Note: {warn}_", ""]
    lines.append(f"Reply with a number (1-{len(items)}) for a detailed report, or send a tender PDF for an eligibility check.")
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
    assert len(out) == 1 and "*1. Tender 1*" in out[0] and "10. Tender 10" in out[0] and "_english_" in out[0]
    assert "No strong" in format_digest([], [])[0]
    assert bid_call(80).startswith("Bid") and bid_call(80, "High").startswith("Do not")
    assert bid_call(45).startswith("Consider") and bid_call(10).startswith("Skip") and bid_call(None).startswith("Skip")
    assert pdf_call("Well aligned").startswith("Bid") and pdf_call("Not aligned").startswith("Do not")
    assert _days({"score_parts": {"days_left": 1}}) == "1 day left"
    print("wa self-check ok")
