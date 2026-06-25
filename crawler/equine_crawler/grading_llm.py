"""LLM grading backends with automatic provider fallback.

Order (configurable via GRADING_PROVIDERS, default "gemini,anthropic"):
  1. Gemini  (GEMINI_API_KEY,  GEMINI_MODEL    default gemini-2.0-flash)
  2. Claude  (ANTHROPIC_API_KEY, ANTHROPIC_MODEL default claude-haiku-4-5-20251001)
  3. OpenAI  (OPENAI_API_KEY,   GRADING_MODEL    default gpt-4o-mini)

On a rate-limit/quota error or any failure, we advance to the next provider.
If every configured provider fails, grade_with_llm raises and the caller
(grading.grade_listing) falls back to the keyword heuristic.
"""

from __future__ import annotations

import json
import os
import re

from .schemas import GradedCategory, Grade

_SYSTEM = (
    "You verify whether an equine business belongs to specific service categories, "
    "based ONLY on the provided text from the business. For each category return a "
    "grade: 3 = explicit evidence it offers this (quote it), 2 = suggestive but not "
    "conclusive, 1 = no evidence. Be strict: infer nothing not stated. Return JSON "
    'as {"results":[{"category_slug":..,"grade":1|2|3,"confidence":0..1,'
    '"evidence_quote":".."}]}'
)


class RateLimit(Exception):
    """Raised by a provider when it hits a quota/rate limit so we fall back."""


def _build_prompt(candidate_categories: list[str], *texts: str) -> str:
    text = "\n\n".join(t for t in texts if t)[:12000]
    return (
        f"Business text:\n{text}\n\n"
        f"Categories to grade: {', '.join(candidate_categories)}\n"
        "Respond with JSON only."
    )


def _parse(content: str, candidate_categories: list[str]) -> list[GradedCategory]:
    # Strip code fences if a model wraps JSON.
    content = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.M).strip()
    data = json.loads(content or "{}")
    by_slug = {r.get("category_slug"): r for r in data.get("results", [])}
    out: list[GradedCategory] = []
    for slug in candidate_categories:
        r = by_slug.get(slug, {})
        grade = int(r.get("grade", 1) or 1)
        out.append(
            GradedCategory(
                category_slug=slug,
                grade=Grade(grade if grade in (1, 2, 3) else 1),
                confidence=float(r.get("confidence", 0.0) or 0.0),
                evidence_quote=(r.get("evidence_quote") or None),
            )
        )
    return out


def _is_rate_limit(exc: Exception) -> bool:
    s = f"{type(exc).__name__} {exc}".lower()
    return any(k in s for k in ("rate", "quota", "429", "resourceexhausted", "overloaded", "529"))


# ── Providers ──────────────────────────────────────────────────────────────


def _gemini(prompt: str, candidate_categories: list[str]) -> list[GradedCategory]:
    from google import genai  # current SDK (google-genai)
    from google.genai import types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    try:
        resp = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM,
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )
    except Exception as exc:  # noqa: BLE001
        raise RateLimit(str(exc)) if _is_rate_limit(exc) else exc
    return _parse(resp.text or "{}", candidate_categories)


def _anthropic(prompt: str, candidate_categories: list[str]) -> list[GradedCategory]:
    import anthropic

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    try:
        msg = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=1024,
            temperature=0.1,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as exc:  # noqa: BLE001
        raise RateLimit(str(exc)) if _is_rate_limit(exc) else exc
    content = "".join(block.text for block in msg.content if getattr(block, "type", "") == "text")
    return _parse(content, candidate_categories)


def _openai(prompt: str, candidate_categories: list[str]) -> list[GradedCategory]:
    from openai import OpenAI

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    try:
        resp = client.chat.completions.create(
            model=os.environ.get("GRADING_MODEL", "gpt-4o-mini"),
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": _SYSTEM}, {"role": "user", "content": prompt}],
        )
    except Exception as exc:  # noqa: BLE001
        raise RateLimit(str(exc)) if _is_rate_limit(exc) else exc
    return _parse(resp.choices[0].message.content or "{}", candidate_categories)


_PROVIDERS = {
    "gemini": ("GEMINI_API_KEY", _gemini),
    "anthropic": ("ANTHROPIC_API_KEY", _anthropic),
    "claude": ("ANTHROPIC_API_KEY", _anthropic),
    "openai": ("OPENAI_API_KEY", _openai),
}


def configured_providers() -> list[str]:
    order = os.environ.get("GRADING_PROVIDERS", "gemini,anthropic,openai")
    out: list[str] = []
    for name in (p.strip().lower() for p in order.split(",")):
        spec = _PROVIDERS.get(name)
        if spec and os.environ.get(spec[0]) and name not in out:
            out.append(name)
    return out


def any_provider_available() -> bool:
    return bool(configured_providers())


def grade_with_llm(candidate_categories: list[str], *texts: str) -> list[GradedCategory]:
    providers = configured_providers()
    if not providers:
        raise RuntimeError("no LLM provider configured")
    prompt = _build_prompt(candidate_categories, *texts)
    last_exc: Exception | None = None
    for name in providers:
        _, fn = _PROVIDERS[name]
        try:
            return fn(prompt, candidate_categories)
        except RateLimit as exc:
            last_exc = exc
            continue  # provider exhausted -> next in chain
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            continue
    raise RuntimeError(f"all LLM providers failed: {last_exc}")
