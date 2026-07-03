"""Extraction (T29).

Live sources use crawl4ai's AsyncWebCrawler + JsonCssExtractionStrategy (polite:
robots, semaphore, delay). Offline runs load JSON fixtures so the rest of the
pipeline (normalize -> grade -> dedup -> upsert) is testable without network or
an API key.
"""

from __future__ import annotations

import json
import os
import time
import urllib.request
from pathlib import Path

from ..registry import Source
from ..schemas import RawListing
from .geo_validate import validated_geo

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

# Google Places Text Search returns up to 20 results per page. Dense counties
# (Ocala, Wellington, Aubrey, …) have more, so CRAWL_MAX_PAGES > 1 follows the
# nextPageToken to record the true count. Default 1 page (breadth runs); the
# surgical "deep" mode sets this to 3 (~60/search).
_MAX_PAGES = max(1, int(os.environ.get("CRAWL_MAX_PAGES", "1")))
# Places API (New) accepts nextPageToken almost immediately; a small delay is
# plenty (the old 2s was a legacy-API requirement that made deep runs time out).
_PAGE_DELAY_S = float(os.environ.get("CRAWL_PAGE_DELAY", "0.4"))


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


def _places_county(components: list[dict] | None) -> str | None:
    """Pull the county name (administrative_area_level_2) from addressComponents.
    Lets the geocoder create the city under the right county for statewide runs."""
    for c in components or []:
        if "administrative_area_level_2" in c.get("types", []):
            return c.get("longText") or c.get("shortText")
    return None


def _places_state(components: list[dict] | None) -> str | None:
    """Pull the 2-letter state code (administrative_area_level_1) from
    addressComponents. Disambiguates same-named counties across states (e.g.
    Jefferson County) when resolving/creating locations nationally."""
    for c in components or []:
        if "administrative_area_level_1" in c.get("types", []):
            return c.get("shortText") or c.get("longText")
    return None


def _fetch_places(source: Source, limit: int | None) -> list[RawListing]:
    """Google Places Text Search (New). Authoritative local-business data."""
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_MAPS_API_KEY is not set (see crawler/.env.example)")

    # Field mask must include nextPageToken when paginating.
    field_mask = _PLACES_FIELDS + (",nextPageToken" if _MAX_PAGES > 1 else "")

    def _fetch_page(query: str, page_token: str | None) -> dict:
        payload = {"textQuery": query, "regionCode": "US"}
        if page_token:
            payload["pageToken"] = page_token
        req = urllib.request.Request(
            _PLACES_ENDPOINT,
            data=json.dumps(payload).encode(),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": field_mask,
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())

    by_id: dict[str, RawListing] = {}
    order: list[str] = []
    for phrase, category in source.query_specs:
        for area in source.areas:
            query = f"{phrase} {area}"
            token: str | None = None
            page = 0
            total = 0
            while page < _MAX_PAGES:
                try:
                    data = _fetch_page(query, token)
                except Exception as exc:  # noqa: BLE001
                    print(f"[places] query failed {query!r} (page {page + 1}): {exc}", flush=True)
                    break
                places = data.get("places", [])
                total += len(places)
                page += 1
                for p in places:
                    pid = p.get("id")
                    name = (p.get("displayName") or {}).get("text")
                    if not pid or not name:
                        continue
                    # Skip permanently-closed places — don't list dead barns.
                    if p.get("businessStatus") == "CLOSED_PERMANENTLY":
                        continue
                    if pid in by_id:
                        # Same place surfaced by another search — merge categories.
                        cats = by_id[pid].candidate_categories
                        if category not in cats:
                            cats.append(category)
                        continue
                    loc = p.get("location") or {}
                    by_id[pid] = RawListing(
                        name=name,
                        address=p.get("formattedAddress"),
                        city=_places_city(p.get("addressComponents")),
                        county=_places_county(p.get("addressComponents")),
                        state=_places_state(p.get("addressComponents")),
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
                token = data.get("nextPageToken")
                if not token:
                    break
                time.sleep(_PAGE_DELAY_S)
            suffix = f" ({page} pages)" if page > 1 else ""
            print(f"[places] {query!r} -> {total} results{suffix}", flush=True)

    listings = [by_id[pid] for pid in order]
    return listings[:limit] if limit else listings


def _load_fixtures(source: Source) -> list[RawListing]:
    listings: list[RawListing] = []
    for path in sorted(FIXTURES_DIR.glob("*.json")):
        rows = json.loads(path.read_text(encoding="utf-8"))
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


def _to_float(v) -> float | None:
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _to_int(v) -> int | None:
    try:
        return int(float(v)) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _gmaps_address(r: dict) -> str:
    """Coerce a gosom row's address to a string.

    gosom emits a plain `address` string for most places, but for some it leaves
    `address` blank and only fills the structured `complete_address` object
    ({borough, street, city, postal_code, state, country}). RawListing.address is
    a str, so build one from the parts when the flat field is empty.
    """
    a = r.get("address")
    if isinstance(a, str) and a.strip():
        return a.strip()
    ca = a if isinstance(a, dict) else r.get("complete_address")
    if isinstance(ca, dict):
        parts = [ca.get("street"), ca.get("city"), ca.get("state"), ca.get("postal_code")]
        joined = ", ".join(str(p).strip() for p in parts if p and str(p).strip())
        if joined:
            return joined
    if isinstance(ca, str) and ca.strip():
        return ca.strip()
    return ""


def _gmaps_city(r: dict) -> str | None:
    """Pull the city from a gosom row.

    gosom carries the city in the structured `complete_address` object (and
    sometimes a flat `city` field); the flat `address` string often omits a
    cleanly parseable city. Returning it here lets the geocoder place the listing
    under its county — without it every row resolves to "no location" and is
    skipped. Falls back to None so normalize()'s address regex can still try.
    """
    direct = r.get("city")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    for key in ("complete_address", "address"):
        ca = r.get(key)
        if isinstance(ca, dict):
            c = ca.get("city")
            if c and str(c).strip():
                return str(c).strip()
    return None


def _parse_gmaps_rows(text: str) -> list[dict]:
    """gosom -json writes either a JSON array or newline-delimited JSON."""
    text = text.strip()
    if not text:
        return []
    try:
        data = json.loads(text)
        return data if isinstance(data, list) else [data]
    except json.JSONDecodeError:
        rows = []
        for line in text.splitlines():
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return rows


def _load_gmaps_file(source: Source, limit: int | None) -> list[RawListing]:
    """Ingest a gosom (google-maps-scraper) JSON results file produced locally.

    County/state come from the per-query custom id we embed as `#!#County|ST`
    (see scripts/gen_gmaps_queries.py) and gosom echoes back in `input_id` — the
    geocoder needs them to place the city under the right county.
    """
    path = os.environ.get("GMAPS_FILE")
    if not path:
        raise RuntimeError("GMAPS_FILE not set (path to gosom results .json)")
    rows = _parse_gmaps_rows(Path(path).read_text(encoding="utf-8"))
    print(f"[gmaps] loaded {len(rows)} rows from {path}", flush=True)

    by_id: dict[str, RawListing] = {}
    order: list[str] = []
    for r in rows:
        name = r.get("title") or r.get("name")
        if not name:
            continue
        status = (r.get("status") or "").lower()
        if "permanently closed" in status or status == "closed_permanently":
            continue
        cid = str(r.get("cid") or r.get("data_id") or r.get("place_id") or "").strip()
        ext = f"google:{cid}" if cid else None
        address = _gmaps_address(r)
        key = ext or f"{name}|{address}"
        if key in by_id:
            continue

        # County|ST from the embedded custom id (falls back to None -> geocoder
        # then tries state-less seeded-city match).
        county = state = None
        tag = r.get("input_id") or r.get("id") or ""
        if isinstance(tag, str) and "|" in tag:
            c, _, s = tag.rpartition("|")
            county, state = (c.strip() or None), (s.strip().upper() or None)

        lat = _to_float(r.get("latitude"))
        lng = _to_float(r.get("longitude") if r.get("longitude") is not None else r.get("longtitude"))
        gps = r.get("gps_coordinates") or {}
        if lat is None:
            lat = _to_float(gps.get("latitude"))
        if lng is None:
            lng = _to_float(gps.get("longitude"))

        # The query tag describes the SEARCH AREA, not the listing: Google pads
        # sparse rural queries with out-of-area results, which used to file
        # (e.g.) South-Florida barns under Indiana counties and mint phantom
        # cities there. Cross-check the tag against the listing's own address
        # state + coordinates, and drop/correct it when they disagree.
        county, state = validated_geo(county, state, address, lat, lng)

        cats = r.get("categories") or ([r["category"]] if r.get("category") else [])

        by_id[key] = RawListing(
            name=name,
            address=address,
            city=_gmaps_city(r),
            county=county,
            state=state,
            phone=r.get("phone"),
            website=r.get("website") or r.get("site"),
            description=r.get("description") or None,
            latitude=lat,
            longitude=lng,
            candidate_categories=list(source.candidate_categories),
            source_url=r.get("link"),
            external_id=ext,
            primary_type=(r.get("category") or (cats[0] if cats else None)),
            types=cats,
            rating=_to_float(r.get("review_rating") if r.get("review_rating") is not None else r.get("rating")),
            rating_count=_to_int(r.get("review_count") if r.get("review_count") is not None else r.get("reviews")),
            business_status=r.get("status"),
            hours=r.get("open_hours") if isinstance(r.get("open_hours"), dict) else None,
        )
        order.append(key)

    listings = [by_id[k] for k in order]
    return listings[:limit] if limit else listings


async def extract(source: Source, limit: int | None = None) -> list[RawListing]:
    if source.key == "fixtures":
        rows = _load_fixtures(source)
        return rows[:limit] if limit else rows
    if source.kind == "gmaps":
        return _load_gmaps_file(source, limit)
    if source.kind == "places":
        return _fetch_places(source, limit)
    return await _crawl_live(source, limit)
