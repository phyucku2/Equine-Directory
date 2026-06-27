"""Seed-source registry.

Each source declares where to crawl, how to extract rows (a crawl4ai
JsonCssExtractionStrategy schema), and which candidate category slugs its
listings imply (to be graded downstream). Keep politeness conservative and
respect each site's robots.txt / ToS (constitution 2.5).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Source:
    key: str
    name: str
    urls: list[str]
    # crawl4ai JsonCssExtractionStrategy schema (baseSelector + fields).
    css_schema: dict[str, Any]
    candidate_categories: list[str]
    delay_seconds: float = 2.0
    max_concurrency: int = 3
    respect_robots: bool = True
    # "crawl" = HTML scrape via crawl4ai; "places" = Google Places API;
    # "fixtures" handled by key.
    kind: str = "crawl"
    # Places: search areas (text) x query_specs (phrase, category slug).
    areas: list[str] = field(default_factory=list)
    query_specs: list[tuple[str, str]] = field(default_factory=list)


# A directory-style source: one row per listing card. Selectors are illustrative
# and should be confirmed against the live markup before a production run.
OHORSE = Source(
    key="ohorse",
    name="O Horse! County Directory",
    urls=[
        # Broward County directory pages (Davie & the South FL equestrian belt).
        "https://www.ohorse.com/horse-boarding/florida/broward-county/",
        "https://www.ohorse.com/horse-trainers/florida/broward-county/",
    ],
    css_schema={
        "name": "ohorse_listing",
        "baseSelector": "div.listing, li.directory-item",
        "fields": [
            {"name": "name", "selector": "h3, .listing-title, a", "type": "text"},
            {"name": "address", "selector": ".address, .listing-address", "type": "text"},
            {"name": "phone", "selector": ".phone, .tel", "type": "text"},
            {"name": "website", "selector": "a.website, a[href^='http']", "type": "attribute", "attribute": "href"},
            {"name": "description", "selector": ".description, .listing-desc", "type": "text"},
        ],
    },
    candidate_categories=["horse-boarding", "trainer-instructor"],
)

# Offline fixture source used for the dry run / CI (no network, no API key).
FIXTURES = Source(
    key="fixtures",
    name="Local fixtures",
    urls=["file://fixtures/ohorse_marion.html"],
    css_schema=OHORSE.css_schema,
    candidate_categories=["horse-boarding", "trainer-instructor", "feed-forage"],
    delay_seconds=0.0,
)


# Google Places API source — authoritative local-business data (name, address,
# phone, website, geo). Text-search queries target the Davie/Broward belt; the
# grading step confirms which results are truly boarding/training stables.
PLACES = Source(
    key="places",
    name="Google Places",
    urls=[],
    css_schema={},
    candidate_categories=["horse-boarding"],
    kind="places",
    areas=[
        "Davie FL",
        "Southwest Ranches FL",
        "Cooper City FL",
        "Parkland FL",
        "Coconut Creek FL",
        "Plantation FL",
        "Coral Springs FL",
        "Broward County FL",
    ],
    # (search phrase, category slug) — the slug matches the seeded taxonomy and
    # is treated as confirmed evidence (Google returned it for that search).
    query_specs=[
        ("horse boarding", "horse-boarding"),
        ("horse stables", "horse-boarding"),
        ("equestrian center", "horse-boarding"),
        ("horse trainer", "trainer-instructor"),
        ("riding lessons", "trainer-instructor"),
        ("horse farrier", "farrier"),
        ("equine veterinarian", "equine-veterinarian"),
        ("tack shop", "tack-shop"),
        ("horse feed store", "feed-forage"),
    ],
)


REGISTRY: dict[str, Source] = {s.key: s for s in [PLACES, OHORSE, FIXTURES]}


def get_source(key: str) -> Source:
    if key not in REGISTRY:
        raise KeyError(f"unknown source '{key}'. Known: {', '.join(REGISTRY)}")
    return REGISTRY[key]
