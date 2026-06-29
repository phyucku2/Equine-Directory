"""Owner-profile facet vocabulary (crawler mirror of web/src/lib/facets.ts).

The crawler uses this to PRE-FILL low-confidence facets from Google data
(primaryType, types, editorialSummary keywords). Owner edits always win — the
upsert only fills a facet column when the key is not in ownerEditedFacets and the
column is currently empty (see pipeline/upsert.py).
"""

from __future__ import annotations

import re

# Canonical slug sets (must match facets.ts). Only what the crawler references.
DISCIPLINES = {
    "dressage", "hunter-jumper", "hunters", "jumpers", "eventing", "equitation",
    "hunt-seat", "saddle-seat", "reining", "cutting", "cow-horse", "roping",
    "barrel-racing", "western-pleasure", "ranch-riding", "horsemanship", "working-cow",
    "trail-pleasure", "endurance", "driving", "gaited", "polo", "vaulting",
    "sidesaddle", "mounted-shooting", "therapeutic", "all-disciplines", "boarding-only",
}
BOARD_TYPES = {
    "full", "partial", "pasture", "self-care", "stall", "training-board",
    "retirement", "layup-rehab",
}
TRAINING_TYPES = {
    "full-training", "training-rides", "colt-starting", "show-prep", "sales-prep",
    "tune-ups", "groundwork-restart", "conditioning-rehab",
}

# Keyword -> facet slug inference (lowercased substring match on name + summary).
_DISCIPLINE_KEYWORDS: dict[str, str] = {
    "dressage": "dressage",
    "hunter/jumper": "hunter-jumper", "hunter jumper": "hunter-jumper",
    "h/j": "hunter-jumper", "hunters": "hunters", "jumpers": "jumpers",
    "eventing": "eventing", "three-day": "eventing", "equitation": "equitation",
    "saddle seat": "saddle-seat",
    "reining": "reining", "cutting": "cutting", "cow horse": "cow-horse",
    "roping": "roping", "barrel": "barrel-racing", "western pleasure": "western-pleasure",
    "ranch riding": "ranch-riding", "horsemanship": "horsemanship",
    "trail": "trail-pleasure", "endurance": "endurance", "driving": "driving",
    "gaited": "gaited", "polo": "polo", "vaulting": "vaulting",
    "therapeutic": "therapeutic", "hippotherapy": "therapeutic",
}
_BOARD_KEYWORDS: dict[str, str] = {
    "full board": "full", "full-service board": "full",
    "partial board": "partial", "pasture board": "pasture", "field board": "pasture",
    "self care": "self-care", "self-care": "self-care",
    "stall board": "stall", "training board": "training-board",
    "retirement": "retirement", "layup": "layup-rehab", "lay-up": "layup-rehab",
    "rehab": "layup-rehab",
}
_TRAINING_KEYWORDS: dict[str, str] = {
    "full training": "full-training", "training rides": "training-rides",
    "colt starting": "colt-starting", "colt-starting": "colt-starting",
    "show prep": "show-prep", "sales prep": "sales-prep",
    "groundwork": "groundwork-restart", "conditioning": "conditioning-rehab",
}


def _infer(text: str, table: dict[str, str], valid: set[str]) -> list[str]:
    t = " " + text.lower() + " "
    out: list[str] = []
    for kw, slug in table.items():
        if kw in t and slug in valid and slug not in out:
            out.append(slug)
    return out


def infer_facets(name: str | None, summary: str | None, types: list[str] | None) -> dict[str, list[str]]:
    """Best-effort low-confidence facet inference from Google fields.
    Returns only non-empty facet lists; the upsert decides whether to apply them."""
    blob = " ".join(p for p in (name, summary, " ".join(types or [])) if p)
    if not blob.strip():
        return {}
    out: dict[str, list[str]] = {}
    d = _infer(blob, _DISCIPLINE_KEYWORDS, DISCIPLINES)
    b = _infer(blob, _BOARD_KEYWORDS, BOARD_TYPES)
    tr = _infer(blob, _TRAINING_KEYWORDS, TRAINING_TYPES)
    if d:
        out["disciplines"] = d
    if b:
        out["boardTypes"] = b
    if tr:
        out["trainingTypes"] = tr
    return out
