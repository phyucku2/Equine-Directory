"""Category grading: decide whether a business really belongs to each candidate
category, with evidence (specs/spec.md).

  Grade 3 (CONFIRMED) -> explicit evidence  -> auto-publish
  Grade 2 (UNSURE)    -> suggestive only     -> human review
  Grade 1 (NOT)       -> no evidence         -> human review

Two backends:
  * LLM (crawl4ai LLMExtractionStrategy / OpenAI) when OPENAI_API_KEY is set.
  * A deterministic keyword-signal heuristic otherwise (also used in tests).
"""

from __future__ import annotations

import os
import re
from typing import Iterable

from .schemas import GradedCategory, Grade

# Per-category signals. STRONG => explicit offer (grade 3). WEAK => suggestive
# (grade 2). Nothing => grade 1.
CATEGORY_SIGNALS: dict[str, dict[str, list[str]]] = {
    "horse-boarding": {
        "strong": [
            "full board", "partial board", "pasture board", "self-care board",
            "boarding available", "board rate", "stalls available for board",
            "now boarding", "boarding facility", "per month board", "/month",
        ],
        "weak": ["stall", "arena", "turnout", "stable", "paddock", "barn"],
    },
    "trainer-instructor": {
        "strong": [
            "riding lessons", "horse training", "training program", "we train",
            "lessons available", "clinics", "coaching", "trainer",
        ],
        "weak": ["dressage", "jumper", "hunter", "western", "eventing", "lesson"],
    },
    "equine-veterinarian": {
        "strong": ["equine vet", "veterinary", "dvm", "ambulatory vet", "equine hospital"],
        "weak": ["lameness", "vaccination", "dentistry", "surgery"],
    },
    "farrier": {
        "strong": ["farrier", "horseshoeing", "shoeing", "trimming", "corrective shoeing"],
        "weak": ["hoof", "barefoot trim", "afa"],
    },
    "tack-shop": {
        "strong": ["tack shop", "tack store", "saddles", "bridles", "tack and"],
        "weak": ["riding apparel", "english tack", "western tack"],
    },
    "feed-forage": {
        "strong": ["feed store", "hay for sale", "forage", "horse feed", "grain"],
        "weak": ["bedding", "shavings", "supplements"],
    },
    "horse-hauling": {
        "strong": ["horse transport", "horse hauling", "equine transport", "shipping horses"],
        "weak": ["trailer", "long distance", "door to door"],
    },
}

_WORD = re.compile(r"[^a-z0-9/$ ]+")


def _norm(text: str) -> str:
    return _WORD.sub(" ", (text or "").lower())


def grade_heuristic(slug: str, *texts: str) -> GradedCategory:
    """Grade one category from available text using keyword signals."""
    blob = _norm(" ".join(t for t in texts if t))
    signals = CATEGORY_SIGNALS.get(slug)
    if not signals:
        # Unknown category: can't confirm -> unsure.
        return GradedCategory(category_slug=slug, grade=Grade.UNSURE, confidence=0.4)

    strong_hits = [s for s in signals["strong"] if s in blob]
    weak_hits = [w for w in signals["weak"] if w in blob]

    if strong_hits:
        evidence = _find_sentence(texts, strong_hits[0]) or strong_hits[0]
        conf = min(0.99, 0.7 + 0.1 * len(strong_hits))
        return GradedCategory(
            category_slug=slug, grade=Grade.CONFIRMED, confidence=conf, evidence_quote=evidence
        )
    if weak_hits:
        return GradedCategory(
            category_slug=slug,
            grade=Grade.UNSURE,
            confidence=0.45,
            evidence_quote=f"Suggestive signals only ({', '.join(weak_hits[:3])}); no explicit offer.",
        )
    return GradedCategory(
        category_slug=slug,
        grade=Grade.NOT,
        confidence=0.1,
        evidence_quote="No evidence found for this category.",
    )


def _find_sentence(texts: Iterable[str], needle: str) -> str | None:
    needle = needle.lower()
    for text in texts:
        if not text:
            continue
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", text):
            if needle in sentence.lower():
                return sentence.strip()[:1024]
    return None


def llm_available() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


def grade_listing(
    candidate_categories: list[str], *texts: str, use_llm: bool | None = None
) -> list[GradedCategory]:
    """Grade every candidate category. Falls back to the heuristic when the LLM
    backend is unavailable. The first CONFIRMED category is marked primary."""
    if use_llm is None:
        use_llm = llm_available()

    graded: list[GradedCategory]
    if use_llm:
        try:
            from .grading_llm import grade_with_llm  # lazy: optional dependency

            graded = grade_with_llm(candidate_categories, *texts)
        except Exception:
            graded = [grade_heuristic(slug, *texts) for slug in candidate_categories]
    else:
        graded = [grade_heuristic(slug, *texts) for slug in candidate_categories]

    # Mark the best (highest grade, then confidence) as primary.
    if graded:
        best = max(graded, key=lambda g: (int(g.grade), g.confidence))
        for g in graded:
            g.is_primary = g is best
    return graded
