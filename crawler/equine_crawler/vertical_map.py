"""Google-business-type → directory-category mapping, shared by the
reclassification pass (reclassify.py) and the crawl ingest (run.py). Types not
mapped (and venue/vet types without an equine signal) return None — callers
leave those for a human."""

from __future__ import annotations

import json
import re
from pathlib import Path

TRAIL = "recreational-trail-guest-ranch"

# Google/gosom business type -> target category slug. Types not listed (and not
# venue types below) are left alone. Lowercased substring match.
DIRECT_TYPE_MAP: list[tuple[str, str]] = [
    ("feed store", "feed-forage"),
    ("hay supplier", "feed-forage"),
    ("feed manufacturer", "feed-forage"),
    ("pet supply store", "feed-forage"),
    ("tack shop", "tack-shop"),
    ("saddlery", "tack-shop"),
    ("equestrian store", "tack-shop"),
    ("horse supply", "tack-shop"),
    ("western apparel", "tack-shop"),
    ("farrier", "farrier"),
    ("horse breeder", "breeding-facilities"),
    ("stud farm", "breeding-facilities"),
    ("horse riding school", "trainer-instructor"),
    ("riding school", "trainer-instructor"),
    ("horse trainer", "trainer-instructor"),
    ("horseback riding service", TRAIL),
    ("horse riding field", TRAIL),
    ("guest ranch", TRAIL),
    ("dude ranch", TRAIL),
    ("horse rental", TRAIL),
    ("carriage ride", TRAIL),
]

# Vets publish as equine vets only with an equine signal in the text (rural
# mixed practices qualify via "large animal"/"livestock"; small-animal-only
# clinics stay in the queue for a human).
VET_TYPES = ("veterinarian", "animal hospital", "veterinary care")
EQUINE_SIGNAL = re.compile(r"equine|horse|large.animal|livestock|farm animal|mobile vet", re.I)

# Venue types re-file to trail-rides only when the name itself reads equine —
# keeps "Horse Thief Campground" and drops "Jellystone Park".
VENUE_TYPES = ("campground", "rv park", "state park", "park", "tourist attraction", "resort")
VENUE_SIGNAL = re.compile(r"horse|equestrian|trail.rid|stable|ranch|saddle|wrangler|pony", re.I)

# Name-keyword fallback when no scraped type is available for the business.
NAME_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"veterinar|animal hospital|animal clinic|equine hospital", re.I), "equine-veterinarian"),
    (re.compile(r"farrier|horsesho|hoof care", re.I), "farrier"),
    (re.compile(r"\bfeed\b|\bhay\b|\bgrain\b|tractor supply", re.I), "feed-forage"),
    (re.compile(r"saddle|\btack\b|western wear", re.I), "tack-shop"),
    (re.compile(r"trail rid|horseback rid|dude ranch|guest ranch|pony ride|carriage", re.I), TRAIL),
    (re.compile(r"\bbreeder\b|stud farm|stallion station", re.I), "breeding-facilities"),
]


def load_types(path: Path) -> dict[str, str]:
    """external_id ("google:<cid>") -> lowercased primary type, from the crawl
    artifacts (see the reclassify workflow's build-types step)."""
    types: dict[str, str] = {}
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            if not line.strip():
                continue
            row = json.loads(line)
            ext, typ = row.get("external_id"), (row.get("type") or "").strip().lower()
            if ext and typ:
                types[ext] = typ
    return types


def target_for(name: str, description: str, gtype: str | None) -> tuple[str | None, str]:
    """(target slug | None, reason). Vet/venue types are signal-gated."""
    text = f"{name} {description or ''}"
    if gtype:
        for frag, slug in DIRECT_TYPE_MAP:
            if frag in gtype:
                return slug, f"type:{gtype}"
        if any(v in gtype for v in VET_TYPES):
            # The scraped type itself can carry the signal ("equine
            # veterinarian", "livestock veterinarian") — count it.
            if EQUINE_SIGNAL.search(f"{text} {gtype}"):
                return "equine-veterinarian", f"type:{gtype}+signal"
            return None, f"vet-no-signal:{gtype}"
        if any(v in gtype for v in VENUE_TYPES):
            if VENUE_SIGNAL.search(name):
                return TRAIL, f"venue:{gtype}+signal"
            return None, f"venue-no-signal:{gtype}"
    for rx, slug in NAME_RULES:
        if rx.search(name):
            return slug, f"name:{rx.pattern[:24]}"
    return None, "unmapped"
