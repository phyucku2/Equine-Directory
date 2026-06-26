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
from equine_crawler.grading import grade_listing, llm_available
from equine_crawler.pipeline.dedup import find_existing
from equine_crawler.pipeline.extract import extract
from equine_crawler.pipeline.geocode import resolve_location
from equine_crawler.pipeline.normalize import normalize, slugify
from equine_crawler.pipeline.upsert import load_category_ids, upsert_listing
from equine_crawler.registry import get_source
from equine_crawler.schemas import Grade, GradedCategory, NormalizedListing


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
                loc = resolve_location(conn, n.city)
                if not loc:
                    skipped += 1
                    print(f"  skip (no location): {n.name} [{n.city}]")
                    continue
                location_id, lat, lng = loc

                if source.kind == "places":
                    # Google returned this for a category-targeted search, so the
                    # candidate categories are confirmed evidence — auto-publish
                    # under them (no LLM grading needed for Places).
                    graded = [
                        GradedCategory(
                            category_slug=c, grade=Grade.CONFIRMED, confidence=0.9, is_primary=(i == 0)
                        )
                        for i, c in enumerate(n.candidate_categories)
                    ]
                else:
                    graded = grade_listing(n.candidate_categories, n.name, n.description or "", use_llm=use_llm)
                slug = slugify(n.name, n.city or "")
                normalized = NormalizedListing(
                    name=n.name, slug=slug, address=n.address or n.city or "FL",
                    city=n.city, phone=n.phone, website=n.website, description=n.description,
                    latitude=lat, longitude=lng, location_id=location_id,
                    graded_categories=graded, source_url=n.source_url, external_id=n.external_id,
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
    grp = parser.add_mutually_exclusive_group()
    grp.add_argument("--llm", dest="use_llm", action="store_true", default=None)
    grp.add_argument("--no-llm", dest="use_llm", action="store_false")
    args = parser.parse_args()
    asyncio.run(run(args.source, args.limit, args.use_llm))


if __name__ == "__main__":
    main()
