# Equine Directory — Design Dossier

> The single source of truth that drives implementation. Synthesizes product strategy,
> competitive/IA research, the equine taxonomy, the data model, SEO architecture, the
> crawl4ai pipeline, and an autonomous-loop-friendly task list. Conforms to
> `specs/constitution.md`.

**Project:** Florida-first equine business directory, expanding nationally.
**Web:** Next.js (App Router, TypeScript) + Tailwind v4 + React 19, on Vercel.
**Data:** PostgreSQL + Prisma (lat/lng geo; PostGIS optional later).
**Pipeline:** Separate Python `crawl4ai` service seeding Postgres.

> Note on versions: the constitution specifies "Next.js 15"; the scaffold currently pins
> `next@16.2.9` + `react@19`. This dossier targets the installed App-Router stack. Treat the
> major version as the installed one; all App-Router patterns below are forward-compatible.

---

## 1. Vision & Product Strategy

### 1.1 Positioning

The most trusted, comprehensive, well-organized directory of equine businesses — a
**vertical specialist** that beats generalist platforms (Yelp, Google Maps) on trust,
depth of equine-specific data, and SEO, and beats incumbent equine directories
(EquineNow, Board & Stable, DreamHorse, BigEq, LocalHorse) on integration, freshness,
mobile UX, and verified credentials. The market is fragmented and siloed by niche; no one
owns the integrated Florida ecosystem. Florida is a top-3 equine state: ~335,000 horses,
$4.3B economic impact, with dense clusters in Ocala/Marion (Horse Capital, ~75,000 horses,
~1,000 farms) and Wellington/Palm Beach (700+ farms, international circuit).

### 1.2 Strategic Levers

1. **SEO is the growth engine** — target 60% organic (Month 6) → 75% (Month 12+) via
   programmatic hub-and-spoke pages, schema.org markup, and authority link-building.
2. **Trust infrastructure** — claim-your-listing, tiered verification badges, moderated
   reviews. This is the moat vs. commodity directories and the justification for premium pricing.
3. **Seeded density** — never launch empty. The crawler seeds 2,000–3,000 verified Florida
   listings pre-launch, defeating the cold-start chicken-and-egg problem.

### 1.3 User Personas

| Persona | Share | Primary need | Monetization |
|---|---|---|---|
| **Horse owners / equestrians** | 40% | Find boarding, training, vet, farrier, tack | Price-conscious; monetize via ads + newsletter |
| **Barn managers / facility operators** | 35% | Manage reputation, attract boarders/clients | Featured listings, Pro/Enterprise tiers |
| **Service providers** (vet, farrier, trainer, transport) | 25% | Generate qualified leads | Highest willingness to pay: lead-gen + subscriptions |

### 1.4 Phased Roadmap

**Phase 1 — Florida Dominance (Months 1–6).** Finalize schema; seed 2,000–3,000 FL
listings via crawler; verify 50%+; build programmatic city pages (500+ FL cities) and
20+ category hubs; ship LocalBusiness JSON-LD on every listing; claim-your-listing flow.
Direct outreach to top-500 FL businesses (Months 4–5) to seed Featured demand.
*Targets:* 3,000+ listings (67% claimed), 50k MAU (60% organic), 500+ manager accounts.

**Phase 2 — Reviews & Regional Growth (Months 7–12).** Launch reviews + Featured tier in
parallel (flywheel: reviews → social proof → premium conversion). Manager analytics
dashboard. Expand to GA, SC, NC (+TX). *Targets:* 20k listings/4 states, 200k MAU (75%
organic), 100–150 Featured ($12–36k MRR), 50k newsletter subs.

**Phase 3 — Monetization at Scale (Months 13–18).** Lead generation (pilot 50–100
providers at $2–5/lead), advertising (sponsored results + category sponsorships +
newsletter ads), subscription tiers (Pro/Enterprise). Expand to 10+ states. *Targets:*
50k listings, 500k MAU, $122–242k MRR; Year-2 $500k–1M ARR at 80%+ gross margin.

### 1.5 Monetization Ladder (graduated, anti-cannibalization)

1. **Free listings** — drive adoption & network effects (Phase 1).
2. **Featured listings** — $99–149/mo; top-of-category + homepage placement, custom
   profile, direct-contact CTAs (Phase 2).
3. **Lead generation** — $2–5/qualified lead; route to top 3–5 providers by rating/proximity (Phase 3).
4. **Advertising** — sponsored search results (labeled), category sponsorships ($500–2,000/mo),
   newsletter ads (Phase 3).
5. **Subscriptions** — Pro ($99–149/mo: featured + analytics + lead tracking + photos),
   Enterprise ($399+/mo: multi-location, white-label, API) (Phase 3).

*Unit economics:* CAC $500–1,000/business vs. LTV $1,200–1,800 (≈3:1), 80%+ gross margin.

---

## 2. Category Taxonomy

14 top-level categories. Every listing carries the **core field set** below; each category
adds **category-specific fields**. Fields marked `*` are required for a valid listing;
others are optional/enhanced (premium tiers surface them).

### 2.0 Core fields (all listings)

`name*`, `slug*`, `description`, `phone`, `email`, `website`, `address*`, `latitude*`,
`longitude*`, `locationId*` (city), `categories*` (1+ with one primary), `hoursOfOperation`
(JSON), `amenities[]`, `images[]`, `rating` (derived), `reviewCount` (derived),
`isVerified`, `verificationBadge`, `claimStatus`, `dataSourceUrl`, `yearsInOperation`,
`serviceArea`/`serviceRadiusMiles`, `deliveryModel` (in-person | mobile | online | hybrid),
`socialLinks` (JSON), `paymentMethods[]`, `accessibility`.

### 2.1 Categories, subcategories & key category-specific fields

1. **Facilities & Accommodations** — `boarding`, `training-facility`, `breeding-facility`,
   `rescue-sanctuary`, `specialized-accommodation`.
   *Fields:* boardingTypes (full/partial/self/pasture/stall), stallCount, acreage,
   arenas (indoor/outdoor + dimensions/footing), washStalls, tackRooms, trails,
   cross-country course, disciplinesSupported[], onSiteTrainer, vetRelationship,
   farrierOnSite, boardPriceTiers (JSON), availabilityStatus.

2. **Health & Veterinary Services** — `equine-veterinarian`, `equine-dentistry`,
   `farrier`, `chiropractic-bodywork`, `nutrition-supplements`, `therapy-rehabilitation`.
   *Fields:* credentials[] (DVM, board cert, AFA cert), licenseNumber, specialties[]
   (lameness, surgery, dentistry, reproduction, corrective shoeing), emergencyAvailable,
   mobileService, diagnosticCapabilities[], professionalOrgs[] (AAEP, FAEP, AFA).

3. **Training & Instruction** — `trainer-instructor`, `clinician-specialist`,
   `coaching-program`.
   *Fields:* disciplines[] (dressage, hunter/jumper, western, eventing, reining,
   endurance, driving), lessonFormats (private/group/clinic), skillLevels[]
   (beginner→advanced), competitionCoaching, credentials[] (USHJA, USEF, CHA, ARIA, PATH),
   rates, studentAchievements, facilityAffiliationId.

4. **Specialized Animal Care Services** — `grooming-spa`, `farrier` (xref),
   `stall-cleaning`, `exercise-conditioning`.
   *Fields:* serviceFrequency, pricing, specializedEquipment, mobile, serviceArea.

5. **Breeding & Genetics** — `stallion-services`, `reproductive-genetic-services`.
   *Fields:* breedFocus[], stallionRoster (JSON), studFees, reproTech[] (embryo transfer,
   frozen/cooled semen, AI), healthTestingProtocols, foalCare/neonatal, geneticTesting.

6. **Sales, Marketing & Business Services** — `horse-sales-auctions`,
   `equine-photography`, `digital-marketing-web`, `business-consulting`.
   *Fields:* portfolioUrl, experienceYears, trackRecord, serviceMenu (JSON).
   (Horse-sales listings carry classifieds fields: breed, gender, color, height, age,
   discipline, showLevel, registry, price — see §4 optional sale extensions.)

7. **Real Estate & Property Services** — `equine-real-estate`, `farm-construction-management`.
   *Fields:* specialty (sales/management/construction), equestrianCredentials,
   projectTypes[] (arena, fencing, barn, stalls), serviceCounties[].

8. **Products & Supplies** — `tack-shop`, `feed-forage`, `apparel`, `blankets-gear`,
   `stable-supplies`, `supplements-medications`.
   *Fields:* brandsCarried[], inventoryType (new/used), priceRange, deliveryOptions,
   bulkAvailable, customization, expertStaff.

9. **Transportation & Logistics** — `horse-hauling`, `trailer-sales-rental-repair`.
   *Fields:* haulType (local/long-distance/specialty), vehicleSpecs, capacity,
   climateControl, insuranceVerified, DOTNumber, pricingModel.

10. **Events & Competition Services** — `show-organizer`, `event-venue`,
    `clinician-services`, `event-insurance`.
    *Fields:* sanctioningBodies[], disciplines[], classDivisions, spectatorInfo,
    vendorOpportunities, eventCalendar (JSON), venueCapacity.

11. **Breed & Discipline Associations** — `breed-registry`, `discipline-association`.
    *Fields:* breedOrDiscipline, membershipBenefits, eventsHosted, advocacyFocus,
    nationalAffiliation.

12. **Educational & Developmental Services** — `equine-education-academy`, `youth-program`.
    *Fields:* curriculum, ageRanges, credentialsAwarded, programType (4-H, Pony Club, breed youth).

13. **Specialized Professional Services** — `saddle-fitting`, `behavioral-specialist`,
    `genetics-breeding-consultant`, `lameness-rehab-expert`, `equine-dentistry` (xref).
    *Fields:* methodology, expertiseLevel, certifications[], outcomesTracked.

14. **Ancillary Services** — `equine-insurance`, `registry-record-services`,
    `rescue-resources`, `recreational-trail-guest-ranch`.
    *Fields:* coverageTypes[], policyLines, recreationType, bookingAvailable.

### 2.2 Cross-cutting facets (filterable across categories)

`discipline` (English/Western/mixed + specific), `skillLevel`, `deliveryModel`
(in-person/mobile/online), `verificationBadge`, `rating`, `price/board tier`,
`distance/radius`, `location hierarchy`. These power the faceted search (§3.5).

### 2.3 Taxonomy build order (mirrors strategy)

- **Phase 1 (launch):** Facilities (boarding, training), Health (vet, farrier, dentistry), Instruction.
- **Phase 2:** Grooming/care, Transportation, Products (tack/feed/apparel/supplies).
- **Phase 3:** Breeding, Therapy, Sales/Photography/Consulting, Real Estate.
- **Phase 4 (community):** Associations, Education, Events.

---

## 3. Information Architecture & Page Types

Search-first IA with hub-and-spoke linking. Breadcrumbs everywhere, pointing to canonical
URLs. Mobile-first card layouts (44×44px min tap targets, fluid cards, single-column on
mobile). Internal linking: every spoke (listing) links back to its hub (category/location)
and to 2–3 related spokes; every hub links to 5–10 top spokes.

### 3.1 Page-type catalog

| Page type | Route | Render | Purpose |
|---|---|---|---|
| **Home** | `/` | Static/ISR | Search hero, featured listings, top categories, top FL regions, value prop |
| **Category hub** | `/categories/[category]` | Static (build) + ISR | All listings in a category; faceted filters; SEO hub |
| **Category × location hub** | `/[category]/[state]/[county]/[city]` *(or query-faceted)* | ISR on-demand | Programmatic intent pages ("Horse Trainers in Ocala") |
| **Location hubs** | `/locations/[state]` → `/[state]/[county]` → `/[state]/[county]/[city]` | Static top-N + ISR | Geographic browse; aggregate stats |
| **Listing detail** | `/business/[slug]` | ISR (`revalidate 3600`) | Full profile, trust card, reviews, related |
| **Search results** | `/search?q=&filters` | Dynamic (streamed) | Faceted, real-time results |
| **Claim flow** | `/business/[slug]/claim` + `/claim/verify` | Dynamic | Claim-your-listing + verification |
| **Static/content** | `/about`, `/terms`, `/privacy`, blog/guides (Phase 2+) | Static | Trust, legal, SEO content |

### 3.2 Home page anatomy

Hero search bar (location + category + keyword) → featured listings carousel → top
category tiles (icon + count) → top FL regions (Ocala, Wellington, Tampa, Sarasota…) →
"Claim your business" CTA → trust/value strip.

### 3.3 Category & location hub anatomy

H1 = "[Category] in [Location]" → intro/stats line ("42 boarding facilities · avg 4.3★ ·
312 reviews") → faceted filter bar → result card grid (paginated/infinite) → related
content (guides) → internal links to sibling categories/locations. Schema: `BreadcrumbList`
+ `ItemList`/`CollectionPage`; FAQ schema on category pages.

### 3.4 Listing detail anatomy (high-conversion order)

1. Hero image / gallery (≥1200×600, lazy below fold)
2. **Trust card** above fold: name, large star rating (only if ≥3 reviews), review count,
   Claimed/Verified badge, verification date, response rate/time, Featured badge if paid
3. Primary CTA (Contact / Call / Visit Website / Request Quote)
4. Core info card: address, phone, hours, distance, map
5. Services/specialties (scannable list) + amenities grid
6. Description (prose)
7. Reviews (filter by date/rating/keyword; owner responses; sort recent/helpful/highest)
8. Related listings ("Other trainers in Ocala", same category/city)
9. Secondary CTAs + "Claim this business" if unclaimed
   Schema: `LocalBusiness` (+ `Organization` parent for multi-location) with NAP, geo,
   hours, `aggregateRating`, `review`.

### 3.5 Search & faceted filtering

Primary discovery channel. Adaptive facets ordered by importance: **location/distance →
category → discipline → service type → price/board tier → rating → verified badge**. Show
result counts per facet, multi-select, active filters as dismissible chips, instant
(AJAX) updates. Mobile: 3–5 key facets in a horizontal bar + "More Filters" → full-screen
panel. Backend = Postgres full-text (GIN tsvector) for keywords + structured `where`
clauses for facets + haversine distance for radius.

### 3.6 Claim & verification flow

Crawler-seeded listing → owner clicks "Claim" → submits owner name/email → email
verification token (Phase 1) → optional phone/SMS (higher trust) → state business-registry
cross-check for "Trusted" tier (Phase 2). On verify: `claimStatus=VERIFIED`, badge shown,
owner can edit listing + respond to reviews. **Verification tiers:** Unverified →
Verified (email/phone) → Trusted (verified + 5+ positive reviews + business registration)
→ Premium (paid + all above).

---

## 4. Data Model (Prisma)

PostgreSQL + Prisma. National-scale from day one (Country→State→County→City). Geo via
lat/lng; PostGIS optional later. Reviews/ratings derived onto `Business` for fast reads.
Full-text search via a raw GIN index (added in a follow-up SQL migration, since Prisma's
`@@fulltext` is MySQL-only — see note after schema).

```prisma
// web/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum LocationType { COUNTRY STATE COUNTY CITY }
enum ClaimStatus  { PENDING VERIFIED REJECTED }
enum VerificationBadge { UNVERIFIED VERIFIED TRUSTED PREMIUM }
enum ImageSource  { CRAWLER OWNER GOOGLE }
enum DeliveryModel { IN_PERSON MOBILE ONLINE HYBRID }

model Business {
  id               String   @id @default(cuid())
  name             String   @db.VarChar(255)
  slug             String   @unique
  description      String?
  phone            String?  @db.VarChar(32)
  email            String?  @db.VarChar(255)
  website          String?  @db.VarChar(512)

  // Address / geo
  address          String   @db.VarChar(512)
  streetAddress    String?  @db.VarChar(255)
  postalCode       String?  @db.VarChar(16)
  latitude         Float
  longitude        Float

  // Location (denormalized to city for fast filtering)
  locationId       String
  location         Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  // Metadata
  hoursOfOperation Json?
  amenities        String[] @default([])
  deliveryModel    DeliveryModel @default(IN_PERSON)
  serviceRadiusMi  Int?
  yearsInOperation Int?
  attributes       Json?    // category-specific fields (boardingTypes, disciplines, credentials, ...)
  socialLinks      Json?
  paymentMethods   String[] @default([])

  // Derived trust/ratings
  rating           Decimal? @db.Decimal(3, 2)
  reviewCount      Int      @default(0)
  responseRate     Decimal? @db.Decimal(5, 2)
  isVerified       Boolean  @default(false)
  verificationBadge VerificationBadge @default(UNVERIFIED)
  isFeatured       Boolean  @default(false)
  featuredUntil    DateTime?

  // Relations
  categories       BusinessCategory[]
  reviews          Review[]
  claims           ClaimRequest[]
  images           BusinessImage[]
  seo              SeoMetadata?

  // Crawler / audit
  dataSourceUrl    String?
  externalSourceId String?  // dedup key from source
  lastCrawledAt    DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([locationId])
  @@index([slug])
  @@index([latitude, longitude])
  @@index([isFeatured, rating])
  @@unique([name, latitude, longitude]) // coarse dedup guard
}

model Location {
  id          String       @id @default(cuid())
  type        LocationType
  name        String       @db.VarChar(255)
  slug        String       @db.VarChar(255)
  code        String?      @db.VarChar(16)   // "FL", FIPS, etc.
  parentId    String?
  parent      Location?    @relation("LocationHierarchy", fields: [parentId], references: [id])
  children    Location[]   @relation("LocationHierarchy")
  latitude    Float?
  longitude   Float?
  boundingBox Json?
  description String?
  businesses  Business[]
  seo         SeoMetadata?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@unique([slug, type, parentId])
  @@index([parentId])
  @@index([type])
}

model Category {
  id          String   @id @default(cuid())
  name        String   @unique @db.VarChar(255)
  slug        String   @unique @db.VarChar(255)
  description String?
  icon        String?
  parentId    String?  // top-level vs subcategory
  parent      Category? @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  businesses  BusinessCategory[]
  seo         SeoMetadata?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([slug])
  @@index([parentId])
}

model BusinessCategory {
  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  isPrimary  Boolean  @default(false)
  rank       Int      @default(0)

  @@id([businessId, categoryId])
  @@index([categoryId])
}

model Review {
  id          String   @id @default(cuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  authorName  String   @db.VarChar(255)
  authorEmail String?  @db.VarChar(255)
  rating      Int      @db.SmallInt        // 1..5
  title       String?  @db.VarChar(255)
  content     String
  ownerResponse String?
  ownerRespondedAt DateTime?
  isApproved  Boolean  @default(false)
  isSpam      Boolean  @default(false)
  isVerifiedAuthor Boolean @default(false) // phone-verified reviewer
  flagCount   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([businessId])
  @@index([isApproved])
}

model ClaimRequest {
  id                String      @id @default(cuid())
  businessId        String
  business          Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  ownerName         String      @db.VarChar(255)
  ownerEmail        String      @db.VarChar(255)
  ownerPhone        String?     @db.VarChar(32)
  status            ClaimStatus @default(PENDING)
  verificationMethod String?    // "email" | "phone" | "registration"
  verificationToken String?     @unique
  verificationSentAt DateTime?
  verifiedAt        DateTime?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([businessId])
  @@index([status])
}

model BusinessImage {
  id         String      @id @default(cuid())
  businessId String
  business   Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  url        String      @db.VarChar(512)
  altText    String?     @db.VarChar(255)
  caption    String?     @db.VarChar(512)
  width      Int?
  height     Int?
  rank       Int         @default(0)
  source     ImageSource @default(CRAWLER)
  uploadedAt DateTime    @default(now())

  @@index([businessId])
}

model SeoMetadata {
  id             String   @id @default(cuid())
  businessId     String?  @unique
  business       Business? @relation(fields: [businessId], references: [id], onDelete: Cascade)
  categoryId     String?  @unique
  category       Category? @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  locationId     String?  @unique
  location       Location? @relation(fields: [locationId], references: [id], onDelete: Cascade)
  title          String   @db.VarChar(70)
  description    String   @db.VarChar(200)
  keywords       String?  @db.VarChar(255)
  ogTitle        String?  @db.VarChar(255)
  ogDescription  String?  @db.VarChar(200)
  ogImage        String?  @db.VarChar(512)
  structuredData Json?
  robots         String?  @default("index,follow")
  canonical      String?  @db.VarChar(512)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model CrawlJob {
  id          String   @id @default(cuid())
  sourceKey   String                       // "ohorse", "florida-horse-mag", ...
  url         String   @db.VarChar(512)
  status      String   @default("pending") // pending|running|success|failed
  resumeState Json?                         // crawl4ai deep-crawl checkpoint
  itemsFound  Int      @default(0)
  itemsUpserted Int    @default(0)
  error       String?
  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime @default(now())

  @@index([sourceKey])
  @@index([status])
}

model AuditLog {
  id          String   @id @default(cuid())
  action      String   // BUSINESS_CREATED, REVIEW_APPROVED, CLAIM_VERIFIED, ...
  entityType  String
  entityId    String
  details     Json?
  performedBy String   // "crawler" | admin email | owner email
  createdAt   DateTime @default(now())

  @@index([entityType])
  @@index([createdAt])
}
```

**Post-migration raw SQL (full-text + optional geo):**

```sql
-- Full-text search index (run after `prisma migrate`)
CREATE INDEX idx_business_fts ON "Business"
  USING GIN (to_tsvector('english', "name" || ' ' || COALESCE("description", '')));

-- Trigram for fuzzy name dedup / autocomplete
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_business_name_trgm ON "Business" USING GIN ("name" gin_trgm_ops);

-- Optional PostGIS (later phase)
-- CREATE EXTENSION postgis;
-- ALTER TABLE "Business" ADD COLUMN geom geometry(Point,4326);
-- CREATE INDEX idx_business_geom ON "Business" USING GIST (geom);
```

---

## 5. SEO Strategy

### 5.1 URL structure (≤3 levels, stop-words removed)

- Listing: `/business/{slug}` — slug = `{name}-{city}` (e.g. `bobs-boarding-barn-ocala`)
- Category hub: `/categories/{category}` (e.g. `/categories/horse-boarding`)
- Location hubs: `/locations/{state}` · `/locations/{state}/{county}` · `/locations/{state}/{county}/{city}`
- Programmatic intent (hub × location): `/{category}/{state}/{county}/{city}`
  (e.g. `/horse-trainers/florida/marion/ocala`). Generate top-N at build; rest via ISR.

Canonicals: every page self-references its clean canonical; faceted/sorted/paginated
variants (`?sort=`, `?page=`) canonicalize to the base hub (or use "View All" as target).

### 5.2 Programmatic hub-and-spoke

- **Hubs:** category, location (state/county/city), and category×location intersections.
- **Spokes:** individual listings.
- Hubs link to 5–10 top spokes (descriptive anchors: "View other western trainers in
  Ocala"); spokes link back to hub + 2–3 related spokes. Concentrates topical authority.
- Build all category hubs + top-N location hubs at build time (`generateStaticParams`);
  long-tail city/intersection pages render on-demand via ISR (`revalidate: 3600` listings,
  daily categories, weekly locations). On-demand `revalidateTag` webhook from the crawler
  after upserts.

### 5.3 JSON-LD (schema.org)

- **Listing:** `LocalBusiness` (use precise subtype where available, e.g.
  `VeterinaryCare`) with exact NAP, `geo`, `openingHoursSpecification`, `aggregateRating`
  (only when ≥3 reviews), `review[]`, `image[]`. Multi-location → `Organization` parent +
  `LocalBusiness` children with `parentOrganization`.
- **Category/location hubs:** `CollectionPage`/`ItemList` + `BreadcrumbList`; `FAQPage` on
  category pages.
- **Sitewide:** `Organization` + `WebSite` (with `SearchAction`).
- Inject via `<script type="application/ld+json">`; validate with Rich Results Test.

### 5.4 NAP consistency

Document a canonical NAP per business; enforce identical NAP across listing, footer, GBP,
socials, external citations. Even "Suite 100" vs "Ste. 100" dilutes signal. Quarterly NAP
audits (consistency across 15+ platforms ≈ +23% Maps-Pack likelihood).

### 5.5 Sitemaps & crawlability

- Split sitemaps by type/region: `/sitemap-businesses-{state}.xml`,
  `/sitemap-categories.xml`, `/sitemap-locations-{state}.xml`, indexed by `/sitemap.xml`.
- `lastmod` from `updatedAt`; cache `s-maxage=86400, stale-while-revalidate`. Regenerate
  on new listings; respect 50k-URL/file limit (paginate per state).
- `robots.txt`: allow content, disallow `/api/`, admin, claim-verification endpoints.
- Quarterly SEO audit: NAP, Rich Results validation, broken internal links, crawl budget
  (Search Console), local-pack rank for top-20 keywords, duplicate-content/canonicals.

### 5.6 Performance (SEO-adjacent)

LCP <2.5s, CLS <0.1, TTFB <300ms (ISR hits). next/image (WebP/AVIF, lazy below fold),
Tailwind static CSS, Vercel edge cache (1h city pages, 24h categories), streamed search.

---

## 6. crawl4ai Data-Pipeline Architecture

A **separate Python service** (`crawler/`) using `crawl4ai` that discovers, extracts,
normalizes, dedupes, geocodes, and **upserts into Postgres**, then pings the web app's
`/api/revalidate` webhook for affected hubs. Politeness and ToS compliance are
first-class (constitution §2.5).

### 6.1 Architecture & flow

```
Seed sources (registry) ──► AsyncUrlSeeder (sitemap/pattern discovery)
        │                         │
        ▼                         ▼
  CrawlJob rows            URL queue (per source, rate-limited)
        │                         │
        ▼                         ▼
  AsyncWebCrawler.arun_many ─► extraction strategy ─► raw records
        │
        ▼
  Normalize → dedup (trigram name+address+phone) → geocode → map to Location hierarchy
        │
        ▼
  Upsert Postgres (Business + BusinessCategory + BusinessImage) via psycopg
        │
        ▼
  POST /api/revalidate (revalidateTag for affected listing/category/location)
```

### 6.2 Extraction strategy selection

- **`JsonCssExtractionStrategy`** (fast, ~100ms/page) for predictable directory HTML
  (O Horse!, chamber directories, breed-stallion aggregators). Default choice — cheap, deterministic.
- **`LLMExtractionStrategy`** (Pydantic schema, `gpt-4o-mini`, `temperature=0.1`) only
  where markup varies or needs semantic parsing (free-form farm pages, PDFs-as-text).
- **`LLMTableExtraction`** only for table-heavy pages (e.g. USDA census tables).

Pydantic target model mirrors the core fields: `name, address, phone, website, category,
hours, latitude?, longitude?, description, source_url`.

### 6.3 Politeness, robots & ToS

- Parse and honor `robots.txt`; respect crawl-delay.
- `semaphore_count=5–10` per host; `delay_before_return_html=2–3s`; descriptive
  `User-Agent` identifying the bot + contact; rotate UAs only where permitted.
- Cache aggressively (`cache_mode='write'`, optional Redis) to avoid re-hitting sources.
- Back off on 429/403; monitor for IP blocks; never bypass auth or paywalls.
- **ToS posture:** prefer Tier-1/2 public + official-API sources; ToS bind only
  authenticated sessions, but we still honor site policies and attribute via
  `dataSourceUrl`. No MLS scraping without reciprocity; no aggressive scraping.
- Crash recovery: `BFSDeepCrawlStrategy(resume_state=..., on_state_change=...)` persisting
  checkpoints to `CrawlJob.resumeState`.

### 6.4 Florida seed sources (tiered)

**Tier 1 — Official public registries (no legal risk):** USDA NASS Census of Agriculture
(county equine inventory, Table 18); FDACS horse-industry/premises registration; FTBOA
Florida-bred / Sire Stakes registry search; Jockey Club American Stud Book.

**Tier 2 — Industry directories (public, low risk):** Florida Horse Magazine Farm &
Service Directory (Issuu PDFs, 2024/2025 — text extraction); O Horse! county directories
(Marion/Ocala, Wellington, Brevard, Sarasota; farriers/vets/stables); Horse Farms Forever
member directory (Marion-focused, 300+); MadBarn directory (vets/farriers/trainers/boarding
by location); UF/IFAS Extension equine directory.

**Tier 3 — Real-estate enrichment (MLS terms — verify):** Zillow (API preferred), Land &
Farm, Ocala Horse Properties, LAAS Equestrian. Marion County Chamber business directory;
Ocala tourism/business sites (ocalamarion.com, ocalahorse.com).

**Tier 4 — Events (partner-based):** Wellington International/PBIEC, World Equestrian
Center Ocala, ShowGroundsLive/Online (contact for exhibitor data partnerships).

**Tier 5 — Associations (contact-based):** FAEP vet directory, AFA farrier members, breed
registries (AQHA/APHA via public searches/aggregators).

**Tier 6 — Commercial APIs (paid/licensed):** Google Business Profile API, Yelp Fusion API
(categories: Equestrian Center, Horse Boarding, Horse Stables, Farriers, Veterinary) for
enrichment (ratings, hours, photos). Cache results to minimize calls.

*Coverage estimate:* Tier 1–2 ≈ 60–70%; +Tier 3 ≈ 80–85%; +Tier 4 ≈ 90%+.

### 6.5 Seed sequence

- **Week 1 (foundation):** USDA county data; FTBOA registry; Florida Horse Mag PDFs;
  O Horse! county listings.
- **Week 2 (enrichment):** Zillow/Land & Farm properties; Chamber directory; UF/IFAS;
  breed-stallion aggregators.
- **Week 3 (partnerships):** Ocala Horse Properties/LAAS feeds; PBIEC/WEC; Horse Farms
  Forever export; FDACS premises.
- **Ongoing:** Google Business + Yelp API enrichment; scheduled re-crawls for freshness
  (listing expiry/renewal cycle).

### 6.6 Data quality

Fuzzy dedup (`pg_trgm` on name + address + phone, plus `(name, lat, lng)` unique guard);
100% admin review of seeded data pre-launch; geocode + map to `Location` hierarchy on
ingest; `lastCrawledAt` freshness tracking; `AuditLog` of every upsert.

### 6.7 Web upsert contract

Crawler writes Postgres directly via `psycopg` (single source of truth = Prisma schema),
**or** posts to a guarded `POST /api/businesses` (header `x-api-key`) when running outside
the DB network. After a batch, calls `POST /api/revalidate` with
`{ type, slug | category | locationHierarchy }` and `x-revalidate-secret`.

---

## 7. Tech Stack & Repo Structure

### 7.1 Stack

- **Web:** Next.js App Router (TypeScript), React 19, Tailwind v4, on Vercel. ISR + edge
  caching. Vercel Edge Middleware (301 redirects/canonicalization, search rate-limiting).
- **Data:** PostgreSQL + Prisma. lat/lng geo; Postgres FTS (GIN tsvector) + `pg_trgm`;
  PostGIS optional later.
- **Maps:** Mapbox GL JS or Google Maps (server-side geocoding; cache geocodes in DB).
- **Email:** transactional provider (claim verification, review moderation) — e.g. Resend/SendGrid.
- **Crawler:** Python 3.10+, `crawl4ai`, `psycopg[binary]`, `pydantic`, `tenacity`,
  `python-dotenv`; optional FastAPI wrapper + Redis cache; Docker for shared deploy.
- **Analytics:** Vercel Analytics (Core Web Vitals), Search Console.

### 7.2 Repo layout

```
Equine-Directory/
├── web/                        # Next.js app (Prisma lives here)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (business)/[slug]/page.tsx        # listing detail (+ claim/ under it)
│   │   │   ├── (seo)/categories/[category]/page.tsx
│   │   │   ├── (seo)/locations/[state]/[county]/[city]/page.tsx
│   │   │   ├── (seo)/[category]/[state]/[county]/[city]/page.tsx  # intent pages
│   │   │   ├── search/page.tsx
│   │   │   ├── api/{search,filter,businesses,revalidate}/route.ts
│   │   │   ├── api/businesses/[id]/{reviews,claim}/route.ts
│   │   │   ├── sitemap.xml/route.ts  robots.txt/route.ts
│   │   │   ├── layout.tsx  page.tsx (home)
│   │   ├── components/{Business,SEO,Search,Map,Image,Common}/
│   │   ├── lib/{prisma.ts, db/, seo/, search/, images/, validation/, types/}
│   │   └── middleware.ts
│   ├── prisma/{schema.prisma, migrations/, seed.ts}
│   └── next.config.ts
├── crawler/                    # Python crawl4ai pipeline
│   ├── sources/                # one module per seed source (ohorse.py, ftboa.py, ...)
│   ├── pipeline/{extract,normalize,dedup,geocode,upsert}.py
│   ├── schemas.py  registry.py  run.py
│   ├── requirements.txt  .env.example
└── specs/                      # constitution.md, design-dossier.md, tasks.md
```

### 7.3 Environments / config

`DATABASE_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`/`GOOGLE_MAPS_API_KEY`,
`CRAWLER_API_KEY`, `REVALIDATE_SECRET`, email key, `OPENAI_API_KEY` (LLM extraction).
next.config: `images.remotePatterns` allowlist, AVIF/WebP, security headers, rewrites
`/sitemap.xml`→route, `reactStrictMode`.

---

## 8. MVP Scope vs Later Phases — Ordered Task List

Each task is small, independently shippable, and tested to the constitution's
Definition of Done (build/lint/types clean, migration if schema changes, metadata + JSON-LD
where applicable, committed + PR checklist updated). Order is dependency-respecting for an
autonomous loop. **`[MVP]`** = Phase-1 launch scope.

### Foundation & data model

1. `[MVP]` Add Prisma + `lib/prisma.ts` singleton; `DATABASE_URL`; `npm run build` proves wiring.
2. `[MVP]` Author full `schema.prisma` (§4); `prisma migrate dev --name init`.
3. `[MVP]` Follow-up SQL migration: FTS GIN index + `pg_trgm` + name trigram index.
4. `[MVP]` Seed script: Country(US) → FL → FL counties → top FL cities (Marion/Ocala, Palm Beach/Wellington, Hillsborough/Tampa, Sarasota...).
5. `[MVP]` Seed top-level categories + Phase-1 subcategories (boarding, training, vet, farrier, dentistry, instruction) with slugs/icons.

### Core read pages (spokes & hubs)

6. `[MVP]` `lib/db/business.ts`: `getBusinessBySlug`, `getByCategory`, `getByLocation` (paginated).
7. `[MVP]` Listing detail `/business/[slug]` (ISR 3600): trust card, core info, services, description, related; `not-found`.
8. `[MVP]` `LocalBusiness` JSON-LD component + `generateMetadata` (title/desc/canonical/OG) on listing.
9. `[MVP]` `BusinessCard` component (mobile-first, 44px targets, lazy image).
10. `[MVP]` Category hub `/categories/[category]` (`generateStaticParams` + ISR): stats line, card grid, breadcrumbs, `CollectionPage`+`BreadcrumbList` JSON-LD.
11. `[MVP]` Location hubs `/locations/[state]`, `/[state]/[county]`, `/[state]/[county]/[city]` (top-N static + ISR).
12. `[MVP]` Schema-aware `Breadcrumbs` component (canonical hrefs).
13. `[MVP]` Home page: search hero, featured carousel, category tiles, top FL regions, claim CTA; `Organization`+`WebSite` JSON-LD.

### Search & filtering

14. `[MVP]` `GET /api/search` (Postgres FTS, ranked, paginated, cache headers).
15. `[MVP]` `POST /api/filter` faceted (category/rating/location/radius-haversine).
16. `[MVP]` `/search` results page: card grid + facet bar; chips; instant updates.
17. `[MVP]` Mobile faceted UX: horizontal facet bar + full-screen "More Filters" panel.

### SEO infrastructure

18. `[MVP]` Split sitemaps (businesses-by-state, categories, locations) + `/sitemap.xml` index; `robots.txt` route.
19. `[MVP]` Programmatic intent pages `/[category]/[state]/[county]/[city]` (top-N static + ISR) with internal links.
20. `[MVP]` Edge middleware: legacy→canonical 301s; search rate-limit.
21. `[MVP]` `next.config.ts`: image allowlist/AVIF/WebP, security headers, sitemap rewrites.

### Trust: claim & reviews-read

22. `[MVP]` `POST /api/businesses/[id]/claim`: create `ClaimRequest`, email token.
23. `[MVP]` Claim UI on listing + `/claim/verify?token=` endpoint → set `VERIFIED`, show badge.
24. `[MVP]` Render approved reviews + `aggregateRating` (only ≥3) on listing; review JSON-LD.

### Crawler MVP (seed density)

25. `[MVP]` Crawler scaffolding: `registry.py`, Pydantic `schemas.py`, `pipeline/` stubs, `CrawlJob` writes.
26. `[MVP]` Tier-2 source: O Horse! county listings via `JsonCssExtractionStrategy` (politeness: robots, semaphore≤8, 2–3s delay).
27. `[MVP]` Normalize + dedup (`pg_trgm`) + geocode + map to `Location`; upsert `Business`/`BusinessCategory`.
28. `[MVP]` Tier-1/2 sources: USDA county data, Florida Horse Mag PDF extraction, FTBOA registry.
29. `[MVP]` `POST /api/revalidate` (secret-guarded `revalidateTag`); crawler pings after batch.
30. `[MVP]` Seed run → 2,000–3,000 FL listings; admin spot-check; verify ≥50% target underway.

### Phase 2 — Reviews, premium, regional growth

31. Review submission `POST /api/businesses/[id]/reviews` + moderation queue (auto-approve 3–4★, manual extremes).
32. Phone/SMS verification tier; reviewer verification badge; review filtering/sorting UI.
33. Owner review-response workflow; response-rate/time on trust card.
34. Featured tier: `isFeatured`/`featuredUntil`, placement logic, custom profile fields, Featured badge.
35. Manager analytics dashboard (views, impressions, CTR, leads, review sentiment) + email alerts.
36. "Trusted" badge: state business-registration cross-check.
37. State expansion GA/SC/NC(+TX): seed sources, location seeding, sitemaps; crawler source modules.
38. Phase-2 categories: grooming/care, transportation, products (tack/feed/apparel/supplies).
39. FAQ schema on category pages; guides/blog content scaffolding; newsletter capture.
40. Google Business + Yelp Fusion API enrichment (ratings/hours/photos), cached.

### Phase 3 — Monetization at scale

41. Lead-gen: capture forms, routing to top 3–5 providers, lead validation/dedup, `$2–5/lead` billing pilot.
42. Advertising: sponsored (labeled) search results + category sponsorships + newsletter ads + ad dashboard.
43. Subscription tiers (Pro/Enterprise) with feature gating; billing integration.
44. National expansion (TX/KY/NY/CA/PA → 10+ states); regional customization.
45. Multi-location `Organization`+`LocalBusiness` schema; Enterprise multi-location dashboard + API access.
46. Advanced ROI reporting; onboarding workflows; automated lifecycle emails; PostGIS migration if radius perf demands.

---

## Appendix — Key decisions (decisive defaults)

- **Geo:** lat/lng + haversine now; PostGIS only when radius query perf demands (Phase 3).
- **Rating display:** hidden until ≥3 reviews (Airbnb pattern).
- **Crawler↔DB:** crawler writes Postgres directly via `psycopg`; web `/api/businesses`
  guarded endpoint is the fallback for out-of-network runs. Schema (Prisma) is the contract.
- **Extraction default:** `JsonCssExtractionStrategy`; LLM only where markup varies.
- **Faceted variants** canonicalize to the base hub; "View All" is the paginated canonical.
- **MVP launch gate:** 2,000–3,000 verified FL listings before public launch (no empty directory).
```