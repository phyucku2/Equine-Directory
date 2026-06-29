"""Seed-source registry.

Each source declares where to crawl, how to extract rows (a crawl4ai
JsonCssExtractionStrategy schema), and which candidate category slugs its
listings imply (to be graded downstream). Keep politeness conservative and
respect each site's robots.txt / ToS (constitution 2.5).
"""

from __future__ import annotations

import csv
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .us_counties import STATE_COUNTY_AREAS

# Dense counties (>20 boarding results on >=1 search) flagged from prior crawl
# logs — the targets for the surgical "deep" (paginated) re-crawl.
_DENSE_CSV = Path(__file__).resolve().parents[1] / "dense_counties.csv"


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


# Florida counties (the original beta state). Other states' county lists live in
# us_counties.STATE_COUNTY_AREAS (auto-generated from US Census FIPS).
_FL_AREAS: list[str] = [
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
]


def _active_areas() -> list[str]:
    """Pick the crawl's county areas from the CRAWL_STATE env var (2-letter code).
    Defaults to Florida. Lets the GitHub Actions form choose one state per run so
    national rollout happens one affordable batch at a time."""
    code = (os.environ.get("CRAWL_STATE") or "FL").strip().upper()
    if code != "FL" and code not in STATE_COUNTY_AREAS:
        # Fail loud rather than silently crawling Florida on a typo / unseeded state.
        known = ", ".join(["FL", *sorted(STATE_COUNTY_AREAS)])
        raise SystemExit(f"CRAWL_STATE={code!r} is not a known state. Known: {known}")
    full = _FL_AREAS if code == "FL" else STATE_COUNTY_AREAS[code]

    # Surgical deep mode: re-crawl only this state's dense counties (paginated via
    # CRAWL_MAX_PAGES) to record their true counts instead of the 20-cap.
    if os.environ.get("CRAWL_DEEP", "").strip().lower() in ("1", "true", "yes"):
        dense = _dense_areas(code)
        if dense:
            print(f"[registry] deep mode: {len(dense)} dense {code} counties", flush=True)
            return dense
        print(f"[registry] deep mode: no dense list for {code}; using all {len(full)}", flush=True)
    return full


def _dense_areas(code: str) -> list[str]:
    if not _DENSE_CSV.exists():
        return []
    with open(_DENSE_CSV) as fh:
        return [r["area"] for r in csv.DictReader(fh) if r["state"].strip().upper() == code]


# Google Places API source — authoritative local-business data (name, address,
# phone, website, geo). Text-search queries target the active state's counties;
# the grading step confirms which results are truly boarding/training stables.
PLACES = Source(
    key="places",
    name="Google Places",
    urls=[],
    css_schema={},
    candidate_categories=["horse-boarding"],
    kind="places",
    # One text-search area per county in the active state (selected at runtime by
    # the CRAWL_STATE env var; defaults to FL). The geocoder creates each city
    # under its county on the fly (see pipeline/geocode.py), so cities don't need
    # pre-seeding — only counties, which are seeded with coords.
    areas=_active_areas(),
    # (search phrase, category slug) — the slug matches the seeded taxonomy and
    # is treated as confirmed evidence (Google returned it for that search).
    #
    # BOARDING-ONLY for now: V1 is the boarding directory, and keeping the query
    # set tight (3 phrases) is what makes national rollout affordable — each
    # phrase x area is one billable Places call (~$0.04). The adjacent-service
    # categories below are parked in ADJACENT_QUERY_SPECS and can be re-enabled
    # once national boarding coverage is in place.
    query_specs=[
        ("horse boarding", "horse-boarding"),
        ("horse stables", "horse-boarding"),
        ("equestrian center", "horse-boarding"),
    ],
)


# Parked: adjacent equine-service categories, disabled to keep the per-run Places
# bill low during national boarding rollout. Append to PLACES.query_specs to
# re-enable (each entry adds one billable call per area).
ADJACENT_QUERY_SPECS: list[tuple[str, str]] = [
    ("horse trainer", "trainer-instructor"),
    ("riding lessons", "trainer-instructor"),
    ("horse farrier", "farrier"),
    ("equine veterinarian", "equine-veterinarian"),
    ("tack shop", "tack-shop"),
    ("horse feed store", "feed-forage"),
    ("horse trailer dealer", "trailer-sales-rental-repair"),
    ("horse hauling transport", "horse-hauling"),
    ("equine dentist", "equine-dentistry"),
    ("equine chiropractor", "chiropractic-bodywork"),
    ("equine rehabilitation", "therapy-rehabilitation"),
]


# gosom (google-maps-scraper) local pipeline: ingest a JSON results file produced
# by running gosom in Docker locally (no per-page 20 cap, $0/record). The actual
# search areas/depth are controlled by gosom + scripts/gen_gmaps_queries.py; this
# source only configures ingestion (county/state come from each row's custom id).
GMAPS = Source(
    key="gmaps-file",
    name="Google Maps (gosom local file)",
    urls=[],
    css_schema={},
    candidate_categories=["horse-boarding"],
    kind="gmaps",
)


REGISTRY: dict[str, Source] = {s.key: s for s in [PLACES, GMAPS, OHORSE, FIXTURES]}


def get_source(key: str) -> Source:
    if key not in REGISTRY:
        raise KeyError(f"unknown source '{key}'. Known: {', '.join(REGISTRY)}")
    return REGISTRY[key]
