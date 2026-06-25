# Project Constitution — Equine Directory

> The governing principles for this project. Specs, plans, and tasks must conform to this document. (Speckit-style constitution.)

## 1. Mission

Build the most trusted, comprehensive, and well-organized directory of equine
businesses and services — starting in **Florida** and expanding nationwide. The
directory connects horse owners, barn managers, and equestrians with the
businesses they need: barns, stables, boarding, training, feed, tack, veterinary
care, transportation, cleaning, farriers, and every adjacent service.

## 2. Core Principles

1. **SEO-first.** Every page is built to rank. Programmatic, crawlable,
   schema.org-structured, fast. Organic search is the primary growth engine.
2. **Data quality over quantity.** A dense, accurate Florida dataset beats a
   thin national one. Verify, dedupe, and keep listings fresh.
3. **Trust by design.** Claim-your-listing, verification badges, moderated
   reviews. Users must be able to trust what they read.
4. **Performance is a feature.** Core Web Vitals green. Static/ISR by default,
   dynamic only where it earns its cost.
5. **Ethical, polite crawling.** Respect robots.txt and ToS. Rate-limit. Prefer
   public/permitted sources and official APIs. Attribute where required.
6. **Ship small, ship often.** The build runs as an autonomous loop: each
   iteration is a small, independently shippable, tested increment behind a PR.
7. **Own the data model.** The schema is the product's backbone — designed for
   national scale (countries/states/counties/cities) from day one, even while
   seeding one state.
8. **Accessible & mobile-first.** WCAG-minded, responsive, usable on a phone in
   a barn aisle with one bar of signal.

## 3. Tech Constraints

- **Web:** Next.js 15 (App Router, TypeScript), Tailwind CSS, deployed on Vercel.
- **Data:** PostgreSQL + Prisma. Geospatial via lat/lng (PostGIS optional later).
- **Crawler:** Separate Python service using `crawl4ai` that seeds Postgres.
- **Repo layout:** `web/` (Next.js), `crawler/` (Python pipeline), `specs/`
  (Speckit docs), `prisma/` schema lives under `web/`.

## 4. Definition of Done (per increment)

- Builds clean (`npm run build`), lints clean, types check.
- New data-model changes have a Prisma migration.
- New pages have metadata + JSON-LD where applicable.
- Changes are committed with a clear message and pushed to the working branch.
- The draft PR description/checklist is updated to reflect what shipped.

## 5. Non-Goals (for now)

- User-generated long-form content / forums.
- Native mobile apps.
- Real-money transactions / booking payments (later phase).
- Non-equine verticals.

## 6. Autonomous Loop Protocol

Each loop iteration:
1. Pick the next unstarted task from `specs/tasks.md`.
2. Implement it to the Definition of Done.
3. Commit + push; update the PR checklist.
4. Mark the task done; surface blockers/decisions via the PR or a question.
