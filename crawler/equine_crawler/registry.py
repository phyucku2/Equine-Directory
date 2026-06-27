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
    # Statewide: one text-search area per Florida county. The geocoder creates
    # each city under its county on the fly (see pipeline/geocode.py), so we no
    # longer need to pre-seed cities. Counties are seeded with coords already.
    areas=[
        "Alachua County FL", "Baker County FL", "Bay County FL", "Bradford County FL",
        "Brevard County FL", "Broward County FL", "Calhoun County FL", "Charlotte County FL",
        "Citrus County FL", "Clay County FL", "Collier County FL", "Columbia County FL",
        "DeSoto County FL", "Dixie County FL", "Duval County FL", "Escambia County FL",
        "Flagler County FL", "Franklin County FL", "Gadsden County FL", "Gilchrist County FL",
        "Glades County FL", "Gulf County FL", "Hamilton County FL", "Hardee County FL",
        "Hendry County FL", "Hernando County FL", "Highlands County FL", "Hillsborough County FL",
        "Holmes County FL", "Indian River County FL", "Jackson County FL", "Jefferson County FL",
        "Lafayette County FL", "Lake County FL", "Lee County FL", "Leon County FL",
        "Levy County FL", "Liberty County FL", "Madison County FL", "Manatee County FL",
        "Marion County FL", "Martin County FL", "Miami-Dade County FL", "Monroe County FL",
        "Nassau County FL", "Okaloosa County FL", "Okeechobee County FL", "Orange County FL",
        "Osceola County FL", "Palm Beach County FL", "Pasco County FL", "Pinellas County FL",
        "Polk County FL", "Putnam County FL", "St. Johns County FL", "St. Lucie County FL",
        "Santa Rosa County FL", "Sarasota County FL", "Seminole County FL", "Sumter County FL",
        "Suwannee County FL", "Taylor County FL", "Union County FL", "Volusia County FL",
        "Wakulla County FL", "Walton County FL", "Washington County FL",
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
        # Transportation & logistics
        ("horse trailer dealer", "trailer-sales-rental-repair"),
        ("horse hauling transport", "horse-hauling"),
        # Health & veterinary specialists
        ("equine dentist", "equine-dentistry"),
        ("equine chiropractor", "chiropractic-bodywork"),
        ("equine rehabilitation", "therapy-rehabilitation"),
    ],
)


REGISTRY: dict[str, Source] = {s.key: s for s in [PLACES, OHORSE, FIXTURES]}


def get_source(key: str) -> Source:
    if key not in REGISTRY:
        raise KeyError(f"unknown source '{key}'. Known: {', '.join(REGISTRY)}")
    return REGISTRY[key]
