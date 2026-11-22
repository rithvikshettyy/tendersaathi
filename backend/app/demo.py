"""Sample GeM-format bid PDFs (backend/seed/gem_samples) loaded as seed tenders.

Regenerate them (dates are relative to the run day): python seed/make_gem_samples.py
"""
import functools, os
from . import analyzer

SEED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seed", "gem_samples")
PREFIX = "gem-sample:"


def names():
    try:
        return sorted(f for f in os.listdir(SEED_DIR) if f.lower().endswith(".pdf"))
    except FileNotFoundError:
        return []


@functools.lru_cache(maxsize=64)
def _text(name, mtime):
    with open(os.path.join(SEED_DIR, name), "rb") as fh:
        return analyzer.pdf_text(fh.read())


def text(name):
    return _text(name, os.path.getmtime(os.path.join(SEED_DIR, name)))


def path(name):
    """Absolute path of a sample PDF, or None. Only names from the folder listing are accepted."""
    return os.path.join(SEED_DIR, name) if name in names() else None
