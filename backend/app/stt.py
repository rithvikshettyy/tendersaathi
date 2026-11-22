"""Speech-to-text with Sarvam (saaras:v4, mode=transcribe: text in the spoken language).

Used by the chat mic in browsers without built-in live speech recognition. REST limit: 30 s of audio.
Docs: https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe.md
"""
import json, os
import httpx

URL = "https://api.sarvam.ai/speech-to-text"
MODEL = "saaras:v4"
MAX_BYTES = 4 * 1024 * 1024          # ~30 s of browser opus/webm is far below this
CODES = {"en": "en-IN", "hi": "hi-IN", "bn": "bn-IN", "ta": "ta-IN", "te": "te-IN", "kn": "kn-IN",
         "ml": "ml-IN", "mr": "mr-IN", "gu": "gu-IN", "pa": "pa-IN", "od": "od-IN"}
# Domain words the recogniser should spell the way the app does.
KEYTERMS = ["TenderSaathi", "GeM", "CPPP", "EMD", "MSE", "MSME", "Udyam", "GSTIN", "DPIIT", "tender", "bid", "turnover"]


class STTError(Exception):
    def __init__(self, msg, status=502):
        super().__init__(msg)
        self.status = status


def transcribe(audio: bytes, filename: str, content_type: str, lang: str = "") -> dict:
    key = os.getenv("SARVAM_API_KEY")
    if not key:
        raise STTError("SARVAM_API_KEY not set", 503)
    if not audio:
        raise STTError("Empty recording", 400)
    if len(audio) > MAX_BYTES:
        raise STTError("Recording too long (max 30 seconds)", 413)
    data = {"model": MODEL, "mode": "transcribe", "language_code": CODES.get(lang, "unknown"),
            "keyterms": json.dumps(KEYTERMS)}
    try:
        r = httpx.post(URL, timeout=60, headers={"api-subscription-key": key}, data=data,
                       files={"file": (filename or "speech.webm", audio, (content_type or "audio/webm").split(";")[0])})
    except httpx.HTTPError as e:
        raise STTError(f"Sarvam unreachable: {e}")
    if r.status_code != 200:
        try:
            msg = r.json().get("error", {}).get("message") or r.text[:160]
        except ValueError:
            msg = r.text[:160]
        raise STTError(f"Sarvam {r.status_code}: {msg}", 429 if r.status_code == 429 else 502)
    j = r.json()
    return {"text": (j.get("transcript") or "").strip(), "language": j.get("language_code")}
