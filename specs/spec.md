# Specification — Equine Directory

> Speckit `spec.md` — the **what** and **why**. Conforms to `constitution.md`.
> Deep design lives in `design-dossier.md`; this file is the authoritative requirements
> summary plus the additions agreed in conversation (category grading & human review).

## Problem

The equine services market is fragmented across siloed, dated directories. Horse owners
struggle to find and trust boarding, training, vet, farrier, feed/tack, transportation and
related services. There is no integrated, well-organized, SEO-strong, trustworthy directory
— especially in Florida, a top-3 equine state (~335,000 horses, $4.3B impact).

## Goal

A Florida-first, nationally-scalable equine business directory that wins on **trust**,
**equine-specific data depth**, and **SEO**. Launch with 2,000–3,000 verified Florida
listings (never an empty directory).

## Users

- **Horse owners / equestrians** — find boarding, training, vet, farrier, tack/feed.
- **Barn managers / facility operators** — manage reputation, attract clients.
- **Service providers** — generate qualified leads.

## Functional requirements

1. **Listings** across 14 top-level categories (boarding, training, breeding, rescue;
   vet, farrier, dentistry, therapy; instruction; care services; products/tack/feed;
   transportation; events; real estate; associations; education; ancillary). Each listing
   carries a shared core field set + category-specific attributes (see dossier §2).
2. **Geographic hierarchy** Country → State → County → City; lat/lng geo; national-scale
   schema from day one.
3. **Browse & discovery**: category hubs, location hubs, category×location intent pages,
   listing detail pages, and faceted search (location/distance, category, discipline,
   price/board tier, rating, verification).
4. **Trust**: claim-your-listing + tiered verification badges; moderated reviews
   (`aggregateRating` shown only at ≥3 reviews).
5. **SEO**: programmatic hub-and-spoke pages, schema.org JSON-LD, split sitemaps, clean
   canonical URLs, Core Web Vitals green.
6. **Data pipeline**: a Python `crawl4ai` service seeds Postgres from tiered, ToS-respecting
   Florida sources; dedupes, geocodes, maps to the location hierarchy, and revalidates pages.

## Category verification & grading (agreed addition)

A business appearing in a category (e.g. "boarding facility") is a **claim with evidence**,
not a fact. The crawler uses **crawl4ai LLM extraction over the business's own website** to
assign a **grade per category assignment**:

| Grade | Meaning | Routing |
|---|---|---|
| **3 — Confirmed** | Explicit evidence (board rates, "boarding available", boarding inquiry form) | **Auto-published**; eligible for "Verified Boarding"-style badge; evidence quote stored |
| **2 — Unsure** | Suggestive but inconclusive (has stalls/arena, calls itself a "stable", no explicit offer) | **Human review queue** |
| **1 — Not / no evidence** | Nothing indicating the category | **Human review queue** (catch misclassification); not shown for that category by default |

- Grades **1 and 2** land in a **moderation queue**; an admin triages (approve→3, reject,
  recategorize). Only **grade 3** publishes automatically.
- An owner **claiming** the listing is an alternative confirmation path.
- The crawler extractor returns, per candidate category:
  `{ grade: 1|2|3, evidenceQuote, confidence, categoryFields }`.
- Stored on `BusinessCategory`: `grade`, `gradeSource`, `evidenceQuote`, `confidence`,
  `reviewStatus`, `reviewedBy`, `reviewedAt`.

## Non-goals (now)

Forums/UGC content, native apps, payments/booking, non-equine verticals. (See constitution §5.)

## Success metrics (Phase 1)

3,000+ FL listings (≥50% verified), programmatic pages for 500+ FL cities + 20+ category
hubs, JSON-LD on every listing, Core Web Vitals green, organic-search-led growth.
