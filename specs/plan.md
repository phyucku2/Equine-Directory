# Plan — Equine Directory

> Speckit `plan.md` — the **how**. Architecture & approach. Full depth in
> `design-dossier.md` (§3–§7). This file is the implementation contract the
> autonomous loop follows alongside `tasks.md`.

## Architecture at a glance

```
                 ┌─────────────────────────┐
  Seed sources ─►│  crawler/ (Python)       │
  (tiered, ToS-  │  crawl4ai → extract →    │
   respecting)   │  GRADE (1/2/3) →         │
                 │  normalize → dedup →     │
                 │  geocode → upsert        │
                 └───────────┬─────────────┘
                             │ psycopg (direct) / POST /api/businesses (fallback)
                             ▼
                      ┌──────────────┐        ┌────────────────────────────┐
                      │ PostgreSQL   │◄───────│ web/ Next.js (App Router)  │
                      │ + Prisma     │  Prisma│ ISR hubs/spokes, search,   │
                      │ FTS + trgm   │        │ JSON-LD, sitemaps, claim,  │
                      └──────────────┘        │ admin moderation queue     │
                             ▲                └────────────┬───────────────┘
                             │ POST /api/revalidate (revalidateTag)         │
                             └──────────────────────────────────────────────┘
```

## Key technical decisions

- **Web:** Next.js (App Router, TS), Tailwind, React 19 on Vercel. Static/ISR by default,
  dynamic only for search. (Scaffold pins `next@16` — App-Router patterns are forward-compatible.)
- **Data:** PostgreSQL + Prisma. lat/lng + haversine (PostGIS deferred). Postgres FTS (GIN
  tsvector) + `pg_trgm` for fuzzy dedup/autocomplete (raw-SQL follow-up migration).
- **Geo model:** Country→State→County→City `Location` tree; businesses denormalized to city.
- **Trust:** `ClaimRequest` + `VerificationBadge` tiers; reviews moderated; rating hidden <3.
- **Category grading:** per-`BusinessCategory` `grade` (1/2/3) from crawl4ai LLM extraction;
  grade 3 auto-publishes, grades 1–2 → moderation queue + admin triage UI.
- **Crawler:** Python `crawl4ai`; `JsonCssExtractionStrategy` default, `LLMExtractionStrategy`
  for grading + varied markup; politeness (robots, semaphore≤8, delay, attribution).
- **SEO:** hub-and-spoke programmatic pages; schema.org JSON-LD; split sitemaps; canonicals.

## Local development approach

- A Docker **PostgreSQL** container provides `DATABASE_URL` for `prisma migrate`/`db push`
  and seed scripts during development and CI.
- `web/` and `crawler/` are independent deployables sharing the Postgres schema (Prisma is
  the contract; the crawler reads the generated SQL / connects via `psycopg`).

## Build strategy (autonomous loop)

Work the ordered list in `tasks.md` top-down. Each iteration:
1. Take the next unchecked task.
2. Implement to the constitution's Definition of Done (build/lint/types clean; migration if
   schema changes; metadata + JSON-LD where applicable).
3. Commit + push; tick the task in `tasks.md`; update the PR checklist.
4. Surface any decision/blocker via the PR or a question.

Milestones: **M1** data model + seed; **M2** core read pages + JSON-LD; **M3** search;
**M4** SEO infra; **M5** claim + reviews-read + grading/moderation; **M6** crawler MVP →
seed density → launch gate (2,000–3,000 verified FL listings).
