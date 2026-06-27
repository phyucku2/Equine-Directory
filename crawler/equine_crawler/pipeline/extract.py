"""Extraction (T29).

Live sources use crawl4ai's AsyncWebCrawler + JsonCssExtractionStrategy (polite:
robots, semaphore, delay). Offline runs load JSON fixtures so the rest of the
pipeline (normalize -> grade -> dedup -> upsert) is testable without network or
an API key.
"""

from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

from ..registry import Source
from ..schemas import RawListing

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"

_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText"
_PLACES_FIELDS = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.addressComponents",
        "places.location",
        "places.nationalPhoneNumber",
        "places.websiteUri",
        "places.editorialSummary",
        "places.primaryTypeDisplayName",
        "places.primaryType",
        "places.types",
        # Enrichment (bumps to the Pro field tier — see crawler README).
        "places.rating",
        "places.userRatingCount",
        "places.businessStatus",
        "places.regularOpeningHours",
        "places.googleMapsUri",
        "places.photos",
    ]
)

_MAX_PHOTOS = 3


def _places_photos(photos: list[dict] | None) -> list[dict]:
    """Top photo references + author attribution (for the place-photo proxy)."""
    out: list[dict] = []
    for ph in (photos or [])[:_MAX_PHOTOS]:
        ref = ph.get("name")
        if not ref:
            continue
        authors = ph.get("authorAttributions") or []
        attribution = (authors[0].get("displayName") if authors else None) or None
        out.append({"ref": ref, "attribution": attribution})
    return out


def _places_city(components: list[dict] | None) -> str | None:
    """Pull the city/town name from Places addressComponents."""
    for wanted in ("locality", "sublocality_level_1", "administrative_area_level_3"):
        for c in components or []:
            if wanted in c.get("types", []):
                return c.get("longText") or c.get("shortText")
    return None


def _fetch_places(source: Source, limit: int | None) -> list[RawListing]:
    """Google Places Text Search (New). Authoritative local-business data."""
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_MAPS_API_KEY is not set (see crawler/.env.example)")

    by_id: dict[str, RawListing] = {}
    order: list[str] = []
    for phrase, category in source.query_specs:
        for area in source.areas:
            query = f"{phrase} {area}"
            body = json.dumps({"textQuery": query, "regionCode": "US"}).encode()
            req = urllib.request.Request(
                _PLACES_ENDPOINT,
                data=body,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": _PLACES_FIELDS,
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read())
            except Exception as exc:  # noqa: BLE001
                print(f"[places] query failed {query!r}: {exc}", flush=True)
                continue

            places = data.get("places", [])
            print(f"[places] {query!r} -> {len(places)} results", flush=True)
            for p in places:
                pid = p.get("id")
                name = (p.get("displayName") or {}).get("text")
                if not pid or not name:
                    continue
                # Skip permanently-closed places — don't list dead barns.
                if p.get("businessStatus") == "CLOSED_PERMANENTLY":
                    continue
                if pid in by_id:
                    # Same place surfaced by another category search — merge.
                    cats = by_id[pid].candidate_categories
                    if category not in cats:
                        cats.append(category)
                    continue
                loc = p.get("location") or {}
                by_id[pid] = RawListing(
                    name=name,
                    address=p.get("formattedAddress"),
                    city=_places_city(p.get("addressComponents")),
                    phone=p.get("nationalPhoneNumber"),
                    website=p.get("websiteUri"),
                    description=(p.get("editorialSummary") or {}).get("text"),
                    latitude=loc.get("latitude"),
                    longitude=loc.get("longitude"),
                    candidate_categories=[category],
                    source_url=f"https://www.google.com/maps/place/?q=place_id:{pid}",
                    external_id=f"google:{pid}",
                    primary_type=p.get("primaryType"),
                    types=p.get("types") or [],
                    rating=p.get("rating"),
                    rating_count=p.get("userRatingCount"),
                    business_status=p.get("businessStatus"),
                    hours=p.get("regularOpeningHours"),
                    google_maps_uri=p.get("googleMapsUri"),
                    photos=_places_photos(p.get("photos")),
                )
                order.append(pid)

    listings = [by_id[pid] for pid in order]
    return listings[:limit] if limit else listings


def _load_fixtures(source: Source) -> list[RawListing]:
    listings: list[RawListing] = []
    for path in sorted(FIXTURES_DIR.glob("*.json")):
        rows = json.loads(path.read_text())
        for row in rows:
            row.setdefault("candidate_categories", source.candidate_categories)
            listings.append(RawListing(**row))
    return listings


async def _crawl_live(source: Source, limit: int | None) -> list[RawListing]:
    # Imported lazily so the package works without crawl4ai installed.
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
    from crawl4ai.extraction_strategy import JsonCssExtractionStrategy

    strategy = JsonCssExtractionStrategy(source.css_schema)
    config = CrawlerRunConfig(
        extraction_strategy=strategy,
        cache_mode=CacheMode.ENABLED,
        semaphore_count=source.max_concurrency,
        mean_delay=source.delay_seconds,
        check_robots_txt=source.respect_robots,
    )

    listings: list[RawListing] = []
    async with AsyncWebCrawler() as crawler:
        for url in source.urls:
            result = await crawler.arun(url=url, config=config)
            rows = (
                json.loads(result.extracted_content)
                if (result.success and result.extracted_content)
                else []
            )
            html = getattr(result, "cleaned_html", "") or getattr(result, "html", "") or ""
            print(
                f"[debug] {url} success={result.success} rows={len(rows)} html_len={len(html)}",
                flush=True,
            )
            if not rows:
                # Selectors matched nothing — dump real markup so we can fix the
                # css_schema (or detect a bot-block/captcha page).
                print(f"[debug] cleaned_html[:7000] for {url}:\n{html[:7000]}\n[debug-end]", flush=True)
                continue
            for row in rows:
                if not row.get("name"):
                    continue
                listings.append(
                    RawListing(
                        name=row.get("name", ""),
                        address=row.get("address"),
                        phone=row.get("phone"),
                        website=row.get("website"),
                        description=row.get("description"),
                        candidate_categories=list(source.candidate_categories),
                        source_url=url,
                    )
                )
                if limit and len(listings) >= limit:
                    return listings
    return listings


async def extract(source: Source, limit: int | None = None) -> list[RawListing]:
    if source.key == "fixtures":
        rows = _load_fixtures(source)
        return rows[:limit] if limit else rows
    if source.kind == "places":
        return _fetch_places(source, limit)
    return await _crawl_live(source, limit)
