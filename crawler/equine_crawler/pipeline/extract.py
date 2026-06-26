"""Extraction (T29).

Live sources use crawl4ai's AsyncWebCrawler + JsonCssExtractionStrategy (polite:
robots, semaphore, delay). Offline runs load JSON fixtures so the rest of the
pipeline (normalize -> grade -> dedup -> upsert) is testable without network or
an API key.
"""

from __future__ import annotations

import json
from pathlib import Path

from ..registry import Source
from ..schemas import RawListing

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"


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
    return await _crawl_live(source, limit)
