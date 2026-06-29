#!/usr/bin/env python3
"""Equine Directory crawler entrypoint.

Usage:
  python run.py --source fixtures            # offline dry run (no network/API key)
  python run.py --source ohorse --limit 50   # live crawl (needs crawl4ai)
  python run.py --source fixtures --no-llm   # force heuristic grading

Pipeline: extract -> normalize -> resolve location -> grade (1/2/3) -> dedup ->
upsert (grade 3 publishes; 1 & 2 go to the moderation queue) -> revalidate.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import urllib.request

from dotenv import load_dotenv

from equine_crawler.db import connect, gen_id
from equine_crawler.facets import infer_facets
from equine_crawler.grading import grade_listing, llm_available
from equine_crawler.pipeline.dedup import find_existing
from equine_crawler.pipeline.extract import extract
from equine_crawler.pipeline.geocode import resolve_or_create
from equine_crawler.pipeline.normalize import normalize, slugify
from equine_crawler.pipeline.upsert import load_category_ids, upsert_listing
from equine_crawler.registry import get_source
from equine_crawler.schemas import Grade, GradedCategory, NormalizedListing


# Google Places primaryType values that are clearly NOT boarding barns. Places
# the boarding/equestrian search returns with one of these (e.g. Tradewinds Park
# = "park") are routed to the moderation queue instead of auto-publishing.
# Decision is on primaryType only (Google's single best classification) to avoid
# excluding a real barn that merely carries a generic secondary type.
_NONBARN_PRIMARY_TYPES = {
    "park", "national_park", "state_park", "dog_park", "amusement_park", "water_park",
    "tourist_attraction", "historical_landmark", "historical_place", "monument",
    "school", "primary_school", "secondary_school", "preschool", "university",
    "campground", "rv_park", "hiking_area", "national_forest",
    "hotel", "motel", "lodging", "resort_hotel", "bed_and_breakfast", "guest_house",
    "local_government_office", "government_office", "city_hall", "courthouse",
    "hospital", "pharmacy", "shopping_mall", "supermarket", "grocery_store",
    "department_store", "store", "clothing_store", "pet_store", "home_goods_store",
    "restaurant", "cafe", "coffee_shop", "bar", "fast_food_restaurant",
    "church", "place_of_worship", "mosque", "synagogue", "hindu_temple",
    "golf_course", "gym", "fitness_center", "library", "museum", "zoo", "aquarium",
    "parking", "gas_station", "real_estate_agency", "bank", "atm",
    "airport", "transit_station", "bus_station",
}


def _is_nonbarn(primary_type: str | None) -> bool:
    return bool(primary_type) and primary_type in _NONBARN_PRIMARY_TYPES


# gosom returns human-readable category labels (e.g. "Horse boarding service",
# "Park", "Farm shop") rather than Google's snake_case primaryType, so the gmaps
# pipeline screens with keyword matching instead of the exact-type set above.
_NONBARN_TEXT_KEYWORDS = (
    "park", "campground", "rv ", "resort", "hotel", "motel", "lodge", " inn ",
    "museum", "store", "supply", "feed", "tractor", "hardware", "dealer",
    "school", "college", "university", "church", "temple", "mosque",
    "restaurant", "cafe", " bar ", "grill", "golf", "veterinar", "hospital",
    "clinic", "pharmacy", "fairground", "government", "courthouse", "library",
    "gym", "fitness", "zoo", "aquarium", "attraction", "trailhead", "hunting",
    "winery", "vineyard", "brewery", "real estate", "auction", "rodeo",
    "supplier", "equipment", "shop", "nursery", "garden center",
)


def _is_nonbarn_text(category: str | None) -> bool:
    if not category:
        return False
    c = " " + category.lower() + " "
    return any(k in c for k in _NONBARN_TEXT_KEYWORDS)


def _start_job(conn, source_key: str, url: str) -> str:
    job_id = gen_id()
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "CrawlJob" (id, "sourceKey", url, status, "startedAt") '
            "VALUES (%s, %s, %s, 'running', now())",
            (job_id, source_key, url),
        )
    conn.commit()
    return job_id


def _finish_job(conn, job_id: str, status: str, found: int, upserted: int, error: str | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "CrawlJob" SET status=%s, "itemsFound"=%s, "itemsUpserted"=%s, '
            'error=%s, "finishedAt"=now() WHERE id=%s',
            (status, found, upserted, error, job_id),
        )
    conn.commit()


def _revalidate(paths_changed: bool) -> None:
    url = os.environ.get("REVALIDATE_URL")
    secret = os.environ.get("REVALIDATE_SECRET")
    if not (url and secret and paths_changed):
        return
    try:
        req = urllib.request.Request(
            url,
            data=b'{"tag":"businesses"}',
            headers={"Content-Type": "application/json", "x-revalidate-secret": secret},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10).read()
        print("  revalidate: pinged web app")
    except Exception as exc:  # noqa: BLE001
        print(f"  revalidate: failed ({exc})")


async def run(source_key: str, limit: int | None, use_llm: bool | None) -> None:
    source = get_source(source_key)
    print(f"Crawling source '{source.name}' (llm={'on' if (use_llm if use_llm is not None else llm_available()) else 'off'})")

    raws = await extract(source, limit)
    print(f"  extracted {len(raws)} raw listings")

    created = updated = published = queued = skipped = 0
    with connect() as conn:
        job_id = _start_job(conn, source.key, source.urls[0] if source.urls else "")
        cat_ids = load_category_ids(conn)
        try:
            for raw in raws:
                n = normalize(raw)
                loc = resolve_or_create(conn, n.city, n.county, n.latitude, n.longitude, n.state)
                if not loc:
                    skipped += 1
                    print(f"  skip (no location): {n.name} [{n.city}, {n.state}]")
                    continue
                location_id, clat, clng = loc
                # Prefer the source's exact coordinates (Google Places) over the
                # city centroid so map dots land on the actual stable.
                lat = n.latitude if n.latitude is not None else clat
                lng = n.longitude if n.longitude is not None else clng

                if source.kind in ("places", "gmaps"):
                    # Google returned this for a category-targeted search. Auto-
                    # publish genuine facilities, but route clear non-barns (parks,
                    # schools, hotels, stores, …) to moderation instead of the map.
                    nonbarn = (
                        _is_nonbarn_text(n.primary_type)
                        if source.kind == "gmaps"
                        else _is_nonbarn(n.primary_type)
                    )
                    grade = Grade.UNSURE if nonbarn else Grade.CONFIRMED
                    if nonbarn:
                        print(f"  review (non-barn type '{n.primary_type}'): {n.name}", flush=True)
                    graded = [
                        GradedCategory(
                            category_slug=c,
                            grade=grade,
                            confidence=0.4 if nonbarn else 0.9,
                            is_primary=(i == 0),
                        )
                        for i, c in enumerate(n.candidate_categories)
                    ]
                else:
                    graded = grade_listing(n.candidate_categories, n.name, n.description or "", use_llm=use_llm)
                slug = slugify(n.name, n.city or "")
                attributes = {"googleMapsUri": n.google_maps_uri} if n.google_maps_uri else {}
                # Low-confidence facet seeds; upsert applies them only to empty,
                # non-owner-edited columns (see pipeline/upsert._prefill_facets).
                inferred_facets = infer_facets(n.name, n.description, n.types)
                normalized = NormalizedListing(
                    name=n.name, slug=slug,
                    address=n.address or ", ".join(p for p in (n.city, n.state) if p) or "US",
                    city=n.city, phone=n.phone, website=n.website, description=n.description,
                    latitude=lat, longitude=lng, location_id=location_id,
                    graded_categories=graded, source_url=n.source_url, external_id=n.external_id,
                    attributes=attributes, rating=n.rating, rating_count=n.rating_count,
                    hours=n.hours, photos=n.photos, inferred_facets=inferred_facets,
                )

                existing = find_existing(conn, slug, n.name, n.phone, n.website)
                _, action = upsert_listing(conn, normalized, cat_ids, existing)
                created += action == "created"
                updated += action == "updated"
                published += normalized.is_published
                queued += sum(1 for g in graded if g.grade != Grade.CONFIRMED)

            conn.commit()
            _finish_job(conn, job_id, "success", len(raws), created + updated, None)
        except Exception as exc:  # noqa: BLE001
            conn.rollback()
            _finish_job(conn, job_id, "failed", len(raws), created + updated, str(exc))
            raise

    print(
        f"  done: {created} created, {updated} updated, {skipped} skipped | "
        f"{published} published, {queued} category claims sent to review"
    )
    _revalidate(paths_changed=(created + updated) > 0)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Equine Directory crawler")
    parser.add_argument("--source", default="fixtures", help="source key (default: fixtures)")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--file", default=None, help="results file for --source gmaps-file (gosom JSON)")
    grp = parser.add_mutually_exclusive_group()
    grp.add_argument("--llm", dest="use_llm", action="store_true", default=None)
    grp.add_argument("--no-llm", dest="use_llm", action="store_false")
    args = parser.parse_args()
    if args.file:
        os.environ["GMAPS_FILE"] = args.file
    asyncio.run(run(args.source, args.limit, args.use_llm))


if __name__ == "__main__":
    main()
