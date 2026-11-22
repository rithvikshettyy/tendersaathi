import math, os, re, collections, json
import httpx
from .categories import tokens

LANGS = {"en": "English", "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu",
         "kn": "Kannada", "ml": "Malayalam", "mr": "Marathi", "gu": "Gujarati",
         "pa": "Punjabi", "od": "Odia"}


def chunk(text, size=120, overlap=20):
    words = (text or "").split()
    step = size - overlap
    return [" ".join(words[i:i + size]) for i in range(0, max(len(words), 1), step) if words[i:i + size]]


def bm25_top(query, docs, k=5, k1=1.5, b=0.75):
    """docs: list of (source, text). Returns top-k by BM25. Pure python, fine for a few thousand chunks."""
    toks = [tokens(t) for _, t in docs]
    n = len(docs)
    if not n:
        return []
    avg = sum(len(t) for t in toks) / n or 1
    df = collections.Counter(w for t in toks for w in set(t))
    q = tokens(query)
    scored = []
    for i, t in enumerate(toks):
        tf = collections.Counter(t)
        s = 0.0
        for w in q:
            if w not in tf:
                continue
            idf = math.log(1 + (n - df[w] + 0.5) / (df[w] + 0.5))
            s += idf * tf[w] * (k1 + 1) / (tf[w] + k1 * (1 - b + b * len(t) / avg))
        if s > 0:
            scored.append((s, i))
    scored.sort(reverse=True)
    return [docs[i] for _, i in scored[:k]]


def build_corpus(company, tenders, schemes):
    docs = [("Company profile", json.dumps({k: v for k, v in company.items()}, ensure_ascii=False))]
    for s in schemes:
        docs.append((f"Scheme: {s['name']}", f"{s['name']}. {s['desc']} Applicable to you: {s['applicable']}"))
    for t in tenders:
        docs.append((f"Tender: {t['title']}", f"{t['title']}. {t['snippet']} ({t['kind']}, {t['source']})"))
        for part in chunk(t.get("doc_text", "")):
            docs.append((f"Tender PDF: {t['title']}", part))
        for part in chunk(t.get("analysis", "")):
            docs.append((f"Analysis: {t['title']}", part))
        for part in chunk(t.get("intel", "")):
            docs.append((f"Risk intel: {t['title']}", part))
    return docs


def ask(question, context_docs, lang="en", history=None):
    key = os.getenv("SARVAM_API_KEY")
    ctx = "\n\n".join(f"[{s}]\n{t}" for s, t in context_docs) or "(no relevant context found)"
    if not key:
        raise RuntimeError("SARVAM_API_KEY not set in .env")
    system = (
        "You are TenderSaathi, an assistant helping Indian manufacturers and suppliers with tenders. "
        "Answer ONLY from the context below plus general well-known procurement practice; "
        "if the context lacks the answer, say so. Be concise and practical. "
        f"Reply in {LANGS.get(lang, 'English')}.\n\nCONTEXT:\n{ctx}")
    msgs = [{"role": "system", "content": system}] + (history or [])[-6:] + \
           [{"role": "user", "content": question}]
    r = httpx.post("https://api.sarvam.ai/v1/chat/completions", timeout=60,
                   headers={"api-subscription-key": key, "Content-Type": "application/json"},
                   json={"model": "sarvam-105b-conversations", "messages": msgs, "temperature": 0.3})
    if r.status_code != 200:
        raise RuntimeError(f"Sarvam {r.status_code}: {r.text[:200]}")
    text = r.json()["choices"][0]["message"]["content"]
    return re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
