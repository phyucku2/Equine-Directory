"""LLM grading backend (optional).

Used when OPENAI_API_KEY is set. Asks the model, per candidate category, whether
the business's own text proves it offers that service, returning a 1/2/3 grade
with an evidence quote and confidence. Mirrors crawl4ai's LLMExtractionStrategy
contract but operates on already-fetched page text.
"""

from __future__ import annotations

import json
import os

from .schemas import GradedCategory, Grade

_SYSTEM = (
    "You verify whether an equine business belongs to specific service categories, "
    "based ONLY on the provided text from the business. For each category return a "
    "grade: 3 = explicit evidence it offers this (quote it), 2 = suggestive but not "
    "conclusive, 1 = no evidence. Be strict: infer nothing not stated. Return JSON."
)


def grade_with_llm(candidate_categories: list[str], *texts: str) -> list[GradedCategory]:
    from openai import OpenAI  # imported lazily; only when key present

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    text = "\n\n".join(t for t in texts if t)[:12000]
    prompt = (
        f"Business text:\n{text}\n\n"
        f"Categories to grade: {', '.join(candidate_categories)}\n"
        'Respond as JSON: {"results":[{"category_slug":..,"grade":1|2|3,'
        '"confidence":0..1,"evidence_quote":".."}]}'
    )
    resp = client.chat.completions.create(
        model=os.environ.get("GRADING_MODEL", "gpt-4o-mini"),
        temperature=0.1,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": _SYSTEM}, {"role": "user", "content": prompt}],
    )
    data = json.loads(resp.choices[0].message.content or "{}")
    out: list[GradedCategory] = []
    by_slug = {r.get("category_slug"): r for r in data.get("results", [])}
    for slug in candidate_categories:
        r = by_slug.get(slug, {})
        grade = int(r.get("grade", 1))
        out.append(
            GradedCategory(
                category_slug=slug,
                grade=Grade(grade if grade in (1, 2, 3) else 1),
                confidence=float(r.get("confidence", 0.0) or 0.0),
                evidence_quote=(r.get("evidence_quote") or None),
            )
        )
    return out
