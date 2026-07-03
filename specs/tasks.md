# Tasks — Equine Directory (live)

> Speckit `tasks.md`. The autonomous loop works this list top-down. `[x]` done, `[ ]` todo.
> `[MVP]` = Phase-1 launch scope. Depth/rationale in `design-dossier.md` §8.

## Phase 0 — Foundation (scaffolding)

- [x] Repo structure (`web/`, `crawler/`, `specs/`), constitution, README, .gitignore
- [x] Next.js scaffold (`web/`)
- [x] Crawler skeleton (requirements, README, env example)
- [x] Research dossier + Speckit spec/plan/tasks
- [x] Draft PR #1 opened

## Phase 1 — MVP (Florida launch)

### Data model
- [x] T1 `[MVP]` Add Prisma + `lib/prisma.ts` singleton; `DATABASE_URL`; Docker Postgres for dev
- [x] T2 `[MVP]` Author full `schema.prisma` (dossier §4) **incl. grading fields on `BusinessCategory`**; `migrate dev --name init`
- [x] T3 `[MVP]` Follow-up SQL migration: FTS GIN index + `pg_trgm` + name trigram index
- [x] T4 `[MVP]` Seed: Country(US) → FL → FL counties → top FL cities
- [x] T5 `[MVP]` Seed top-level categories + Phase-1 subcategories (boarding, training, vet, farrier, dentistry, instruction)

### Core read pages
- [x] T6 `[MVP]` `lib/db/business.ts`: `getBusinessBySlug`, `getByCategory`, `getByLocation` (paginated, published-only)
- [x] T7 `[MVP]` Listing detail `/business/[slug]` (ISR 3600): trust card, core info, services, description, related
- [x] T8 `[MVP]` `LocalBusiness` JSON-LD + `generateMetadata` on listing
- [x] T9 `[MVP]` `BusinessCard` component (mobile-first, 44px targets, lazy image)
- [x] T10 `[MVP]` Category hub `/categories/[category]` (static params + ISR) + `CollectionPage`/`BreadcrumbList` JSON-LD
- [x] T11 `[MVP]` Location hubs `/locations/[state]`, `/[state]/[county]`, `/[state]/[county]/[city]`
- [x] T12 `[MVP]` Schema-aware `Breadcrumbs` component
- [x] T13 `[MVP]` Home page: search hero, featured, category tiles, top FL regions, claim CTA; `Organization`+`WebSite` JSON-LD

### Search & filtering
- [x] T14 `[MVP]` `GET /api/search` (Postgres FTS, ranked, paginated, cache headers)
- [x] T15 `[MVP]` `POST /api/filter` faceted (category/rating/location/radius-haversine)
- [x] T16 `[MVP]` `/search` results page: card grid + facet bar + chips + instant updates
- [x] T17 `[MVP]` Mobile faceted UX: horizontal bar + full-screen "More Filters"

### SEO infrastructure
- [x] T18a `[MVP]` **noindex gate** (from workflow infographic "noindex check"): listing/hub pages render `robots: noindex,follow` unless confirmed (grade-3/claimed) + min content; only indexable pages enter sitemaps. Protects E-E-A-T / thin-content. Ties to grading.
- [x] T18b `[MVP]` Keyword-research pass → prioritize which category×city intent pages (T19) to pre-render; record target terms in `specs/`.
- [x] T18 `[MVP]` Split sitemaps + `/sitemap.xml` index + `robots.txt`
- [x] T19 `[MVP]` Programmatic intent pages `/[category]/[state]/[county]/[city]` (top-N static + ISR)
- [x] T20 `[MVP]` Edge middleware: legacy→canonical 301s; search rate-limit
- [x] T21 `[MVP]` `next.config.ts`: image allowlist/AVIF/WebP, security headers, sitemap rewrites

### Trust: claim, reviews-read, grading & moderation
- [x] T22 `[MVP]` `POST /api/businesses/[id]/claim`: create `ClaimRequest`, email token
- [x] T23 `[MVP]` Claim UI + `/claim/verify?token=` → set `VERIFIED`, show badge
- [x] T24 `[MVP]` Render approved reviews + `aggregateRating` (≥3) + review JSON-LD
- [x] T25 `[MVP]` **Moderation queue API**: list/triage `BusinessCategory` where grade ∈ {1,2} & `reviewStatus=PENDING_REVIEW`
- [x] T26 `[MVP]` **Admin moderation UI** `/admin/review`: approve→grade 3, reject, recategorize; shows evidence quote
- [x] T27 `[MVP]` Publish gate in read queries: only grade-3 / approved category assignments are publicly listed

### Crawler MVP (seed density)
- [x] T28 `[MVP]` Crawler scaffolding: `registry.py`, Pydantic `schemas.py`, `pipeline/` stubs, `CrawlJob` writes
- [x] T29 `[MVP]` Tier-2 source: O Horse! county listings via `JsonCssExtractionStrategy` (polite)
- [x] T30 `[MVP]` **Grading extractor**: `LLMExtractionStrategy` over business site → `{grade, evidenceQuote, confidence, categoryFields}` per category
- [x] T31 `[MVP]` Normalize + dedup (`pg_trgm`) + geocode + map to `Location`; upsert `Business`/`BusinessCategory` with grade routing
- [ ] T32 `[MVP]` Tier-1/2 sources: USDA county data, Florida Horse Mag PDF, FTBOA registry
- [x] T33 `[MVP]` `POST /api/revalidate` (secret-guarded `revalidateTag`); crawler pings after batch
- [ ] T34 `[MVP]` Seed run → 2,000–3,000 FL listings; admin works moderation queue; verify ≥50%

### Deploy
- [ ] T35 `[MVP]` Vercel project (dedicated, existing team) + Postgres (Neon/Supabase) env; deploy preview; CI build check (GitHub Actions)
- [ ] T35b `[MVP]` QA/audit pass (run /code-review) as a release gate; Google Search Console verification + sitemap submission

## Phase 2 — Reviews, premium, regional growth
- [ ] T36 Review submission + moderation (auto-approve mid, manual extremes)
- [ ] T37 Phone/SMS verification tier; reviewer badge; review filter/sort UI
- [ ] T38 Owner review-response; response-rate/time on trust card
- [ ] T39 Featured tier: placement logic, custom profile fields, Featured badge
- [ ] T40 Manager analytics dashboard + email alerts
- [ ] T41 "Trusted" badge: state business-registration cross-check
- [ ] T42 State expansion GA/SC/NC(+TX): sources, location seeding, sitemaps
- [x] T43a (2026-07-03) Public catalog opened to six verticals — boarding, training,
      vets, farriers, tack, feed (`web/src/lib/catalog.ts`): map service-segment
      filter, category hubs + index, intent pages, sitemaps, saved-search categories.
      Plus **BASIC $9/yr entry tier** (Goal 6) below Verified across schema/
      entitlements/plan UI/Stripe config/admin grants.
- [x] T43b (2026-07-03) Zillow-scale map: viewport (bbox) loading on /api/map with
      CDN-friendly grid-rounded boxes; refetch-on-pan in MapView.
- [x] T43c (2026-07-03) Goal-7 upsells: **camp advertising** ($75/season → Featured
      camps rail on /events; Stripe + webhook + admin grant) and **website-builder
      funnel** (owner Website tab lead form $99/$299 + $49.99/yr; embeddable
      Certified badge `/api/badge/[slug].svg` as the backlink magnet).
- [ ] T43 Phase-2 categories: grooming/care, transportation, remaining products (apparel)
- [x] T44 (2026-07-03) FAQ schema + unique intro copy on category hubs & intent pages
      (`lib/seo/copy.ts`); `/guides` editorial articles with Article JSON-LD + sitemap;
      newsletter capture (NewsletterSubscriber model + `/api/newsletter` + footer form)
- [ ] T45 Google Business + Yelp Fusion API enrichment (cached)

## Phase 3 — Monetization at scale
- [ ] T46 Lead-gen: capture, routing, validation, $2–5/lead billing pilot
- [ ] T47 Advertising: sponsored results + category sponsorships + newsletter ads
- [ ] T48 Subscription tiers (Pro/Enterprise) + feature gating + billing
- [ ] T49 National expansion (10+ states); regional customization
- [ ] T50 Multi-location `Organization` schema + Enterprise dashboard + API
- [ ] T51 ROI reporting; lifecycle emails; PostGIS migration if radius perf demands
