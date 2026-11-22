"""Text-to-speech for chat answers (Sarvam Bulbul). Returns MP3 bytes.

Replies are cleaned of markdown, split at sentence boundaries into chunks under the API's
2,500-character limit, and cached in memory so replaying a message does not bill again.
"""
import base64, collections, hashlib, os, re
import httpx

URL = "https://api.sarvam.ai/text-to-speech"
MODEL = "bulbul:v3"
SPEAKER = "shubh"
CHUNK = 2400            # API limit is 2,500 characters per request
MAX_CHARS = 6000        # per message; keeps cost bounded
CODES = {"en": "en-IN", "hi": "hi-IN", "bn": "bn-IN", "ta": "ta-IN", "te": "te-IN", "kn": "kn-IN",
         "ml": "ml-IN", "mr": "mr-IN", "gu": "gu-IN", "pa": "pa-IN", "od": "od-IN"}

_CACHE: "collections.OrderedDict[str, bytes]" = collections.OrderedDict()
_CACHE_MAX = 64


class TTSError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def clean_for_speech(text: str) -> str:
    """Drop markdown so the voice does not read out asterisks, hashes or URLs."""
    t = re.sub(r"```.*?```", " ", text, flags=re.S)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)          # [label](url) -> label
    t = re.sub(r"https?://\S+", " ", t)
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)
    t = re.sub(r"^\s*[-*•]\s+", "", t, flags=re.M)
    t = re.sub(r"[*_`~>|]", "", t)
    t = re.sub(r"\s*\n\s*", ". ", t)
    t = re.sub(r"\.\s*\.", ".", t)
    return re.sub(r"\s{2,}", " ", t).strip()


def _chunks(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?।॥])\s+", text)
    out, cur = [], ""
    for p in parts:
        while len(p) > CHUNK:                    # a single very long sentence
            out.append(p[:CHUNK]); p = p[CHUNK:]
        if len(cur) + len(p) + 1 > CHUNK and cur:
            out.append(cur); cur = p
        else:
            cur = f"{cur} {p}".strip()
    if cur:
        out.append(cur)
    return out


def _speak(client: httpx.Client, key: str, text: str, code: str) -> bytes:
    r = client.post(URL, headers={"api-subscription-key": key, "Content-Type": "application/json"}, json={
        "text": text, "target_language_code": code, "model": MODEL, "speaker": SPEAKER,
        "speech_sample_rate": 24000, "output_audio_codec": "mp3"})
    if r.status_code != 200:
        raise TTSError(f"Sarvam TTS {r.status_code}: {r.text[:200]}")
    audios = r.json().get("audios") or []
    if not audios:
        raise TTSError("Sarvam TTS returned no audio")
    return base64.b64decode(audios[0])


def synthesize(text: str, lang: str = "en") -> bytes:
    key = os.getenv("SARVAM_API_KEY")
    if not key:
        raise TTSError("SARVAM_API_KEY not set in .env", 503)
    code = CODES.get(lang, "en-IN")
    speech = clean_for_speech(text)[:MAX_CHARS]
    if not speech:
        raise TTSError("Nothing to read aloud", 400)
    ck = hashlib.sha256(f"{code}|{speech}".encode()).hexdigest()
    if ck in _CACHE:
        _CACHE.move_to_end(ck)
        return _CACHE[ck]
    with httpx.Client(timeout=60) as client:
        audio = b"".join(_speak(client, key, c, code) for c in _chunks(speech))   # MP3 frames concatenate cleanly
    _CACHE[ck] = audio
    if len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)
    return audio
