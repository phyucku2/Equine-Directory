# Equine Directory — Crawler

Python data pipeline that discovers and extracts equine-business listings from
permitted public sources using [`crawl4ai`](https://github.com/unclecode/crawl4ai),
normalizes them, and seeds the directory's PostgreSQL database.

## Principles

- **Polite & legal.** Respect `robots.txt` and site ToS. Rate-limit. Prefer
  official APIs and public/permitted sources. Attribute where required.
- **Idempotent.** Re-runs upsert by a stable natural key (name + address /
  phone / website), never duplicate.
- **Structured.** Every record conforms to the `Listing` Pydantic schema before
  it touches the database.

## Setup

```bash
cd crawler
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium   # crawl4ai uses Playwright under the hood
cp .env.example .env          # set DATABASE_URL
```

## Layout (planned)

| Path                | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `equine_crawler/`   | Package: crawler, extractors, normalizers, db sink.  |
| `sources/`          | One config per seed source (URL patterns, selectors).|
| `run.py`            | CLI entrypoint to run a crawl for a given source/category. |

See `specs/plan.md` for the pipeline architecture.
