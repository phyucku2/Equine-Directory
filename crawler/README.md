# Equine Directory — Crawler

Python data pipeline that discovers and extracts equine-business listings from
permitted public sources using [`crawl4ai`](https://github.com/unclecode/crawl4ai),
**grades each category claim (1/2/3)**, normalizes, dedupes, and seeds the
directory's PostgreSQL database.

## Principles

- **Polite & legal.** Respect `robots.txt` and site ToS. Rate-limit. Prefer
  official APIs and public/permitted sources. Attribute via `dataSourceUrl`.
- **Idempotent.** Re-runs upsert by a stable slug / phone / website / fuzzy-name
  key — never duplicate.
- **Graded.** Every category claim is verified before it publishes:
  - **Grade 3 (Confirmed)** — explicit evidence → auto-published.
  - **Grade 2 (Unsure)** — suggestive only → human review queue.
  - **Grade 1 (Not)** — no evidence → human review queue.

## Pipeline

```
extract (crawl4ai JsonCss / fixtures)
  → normalize (clean phone/url/address, infer city, slug)
  → resolve location (seeded FL city → id + coordinates)
  → grade categories (LLM if OPENAI_API_KEY, else keyword heuristic)
  → dedup (pg_trgm + exact keys)
  → upsert Business + BusinessCategory (grade routing)
  → POST /api/revalidate
```

## Setup

```bash
cd crawler
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium      # only needed for LIVE crawls (crawl4ai)
cp .env.example .env             # set DATABASE_URL (and optionally OPENAI_API_KEY)
```

## Run

```bash
# Offline dry run against fixtures — no network or API key needed.
python run.py --source fixtures --no-llm

# Live crawl of a registered source (needs crawl4ai + playwright).
python run.py --source ohorse --limit 50

# Force LLM grading (needs OPENAI_API_KEY).
python run.py --source ohorse --llm
```

The dry run upserts the fixture listings and demonstrates grade routing: real
boarding/training/feed/farrier listings auto-publish, while a cattle operation
(grade 1) and a stalls-but-no-boarding farm (grade 2) are sent to the moderation
queue at `/admin/review`.

> **Live selectors:** the `ohorse` source's CSS schema is illustrative and must
> be confirmed against the live markup before a production run. The fixtures
> path proves the full normalize → grade → dedup → upsert logic offline.

## Layout

| Path                            | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `equine_crawler/schemas.py`     | Pydantic models incl. the `Grade` (1/2/3) enum.    |
| `equine_crawler/registry.py`    | Seed-source configs (URLs, CSS schema, categories).|
| `equine_crawler/grading.py`     | Category grading (heuristic + LLM backend).        |
| `equine_crawler/pipeline/`      | extract · normalize · geocode · dedup · upsert.    |
| `run.py`                        | CLI orchestrator (writes `CrawlJob`, revalidates). |
| `fixtures/`                     | Offline sample data for dry runs / CI.             |
| `tests/`                        | Grading tests (`python tests/test_grading.py`).    |

## Environment

| Var                  | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `DATABASE_URL`       | Postgres connection (same DB Prisma owns).          |
| `OPENAI_API_KEY`     | Enables LLM grading (optional; heuristic otherwise).|
| `GRADING_MODEL`      | LLM model for grading (default `gpt-4o-mini`).      |
| `REVALIDATE_URL`     | Web `/api/revalidate` endpoint to ping after a run. |
| `REVALIDATE_SECRET`  | Shared secret for the revalidate endpoint.          |

See `specs/plan.md` and `specs/design-dossier.md` §6 for the full architecture.
