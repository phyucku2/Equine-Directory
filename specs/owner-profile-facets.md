# Owner Profile Facets — Spec

Zillow-style structured, **filterable** depth for stable listings so owners can
describe their barn (disciplines, boarding, training, pricing, camps, amenities,
security, policies) and boarders can compare/filter. This is the value that makes
an owner claim — and eventually pay.

## 1. Principle

Zillow wins because every listing shares the **same structured fields**, so users
filter and compare. We do the same for stables. The key design rule:

- **High-value filter facets → typed `String[]` array columns** (GIN-indexed, fast
  `@>`/`&&` containment queries). Mirrors the existing `amenities String[]`.
- **Rich-but-not-filtered detail → `Json`** (per-type pricing, program entries,
  care schedule).
- **Numeric range facets → scalar columns** (`priceFrom`, `spotsAvailable`,
  `stallCount`, `acreage`).
- **One controlled vocabulary** shared TS (app) + Python (crawler pre-fill).

## 2. Data model

### 2.1 New `Business` columns (web/prisma/schema.prisma)

```prisma
// Filterable facets (controlled vocab; GIN-indexed)
disciplines       String[] @default([])   // accepted for boarding
trainingTypes     String[] @default([])   // training services offered
trainingDisciplines String[] @default([]) // disciplines trained
lessonLevels      String[] @default([])   // lesson programs
securityFeatures  String[] @default([])
policies          String[] @default([])   // open/closed barn, mares-only, ADA, ...
boardTypes        String[] @default([])
// amenities String[]  — ALREADY EXISTS; vocab expanded

// Numeric range facets
priceFrom         Int?     // derived = min over pricing[].from (kept for fast sort/filter)
spotsAvailable    Int?     // live boarding openings
stallCount        Int?
acreage           Float?

// Rich display (not directly filtered)
pricing           Json?    // { full: {from,to,period,included[]}, pasture: {...}, ... }
programs          Json?    // [{ id, type, name, discipline?, season, price?, ageRange?, capacity?, desc? }]
careDetails       Json?    // { feedingsPerDay, hayType, turnoutHours, supplements, blanketing, ... }

// Provenance: facet keys the owner has explicitly set (crawler must not overwrite)
ownerEditedFacets String[] @default([])
```

> Note: `attributes Json` stays for `offering`, `googleMapsUri`, and misc. The
> structured facets graduate OUT of `attributes` into typed columns so they filter.

### 2.2 Indexes (raw SQL in the migration)

```sql
CREATE INDEX idx_business_disciplines     ON "Business" USING GIN ("disciplines");
CREATE INDEX idx_business_boardtypes      ON "Business" USING GIN ("boardTypes");
CREATE INDEX idx_business_trainingtypes   ON "Business" USING GIN ("trainingTypes");
CREATE INDEX idx_business_security        ON "Business" USING GIN ("securityFeatures");
CREATE INDEX idx_business_policies        ON "Business" USING GIN ("policies");
CREATE INDEX idx_business_amenities       ON "Business" USING GIN ("amenities");
CREATE INDEX idx_business_pricefrom       ON "Business" ("priceFrom");
```

> ⚠️ Migration gotcha: `prisma migrate dev` will try to DROP the existing
> `idx_business_name_trgm` / `idx_business_address_trgm` trigram indexes. Hand-edit
> the generated `migration.sql` to remove those DROP lines before applying (same
> fix used for prior migrations).

## 3. Controlled vocabularies

Defined once in `web/src/lib/facets.ts` (slug + label + group) and mirrored in
`crawler/equine_crawler/facets.py`. Slugs are stable; labels are display text.

### Disciplines (shared by `disciplines` + `trainingDisciplines`)
- **English:** dressage, hunter-jumper, hunters, jumpers, eventing, equitation, hunt-seat, saddle-seat
- **Western:** reining, cutting, cow-horse, roping, barrel-racing, western-pleasure, ranch-riding, horsemanship, working-cow
- **Other:** trail-pleasure, endurance, driving, gaited, polo, vaulting, sidesaddle, mounted-shooting, therapeutic
- **General:** all-disciplines, boarding-only

### Board types (`boardTypes`)
full, partial, pasture, self-care, stall, training-board, retirement, layup-rehab

### Training types (`trainingTypes`)
full-training, training-rides, colt-starting, show-prep, sales-prep, tune-ups, groundwork-restart, conditioning-rehab

### Lesson levels (`lessonLevels`)
beginner, intermediate, advanced, lead-line, lesson-horses-available, adult-programs, youth-programs

### Security & safety (`securityFeatures`)
security-cameras, gated-entry, coded-entry, on-site-manager, owner-on-site, overnight-staff, perimeter-fencing, barn-lighting, arena-lighting, fire-extinguishers, sprinkler-system, smoke-detectors, locked-tack-room, emergency-plan, backup-generator

### Policies (`policies`)
open-barn, closed-barn, mares-only, geldings-only, co-ed, stallions-accepted, no-stallions, ada-accessible, mounting-blocks, quarantine-available, insurance-required, coggins-required, 24-7-access, daylight-access-only

### Amenities (`amenities` — expanded vocab)
indoor-arena, outdoor-arena, covered-arena, round-pen, dressage-court, jumping-field, hot-walker, eurociser, treadmill, wash-rack, hot-water-wash, grooming-stalls, cross-ties, tack-room, tack-lockers, heated-barn, stall-fans, auto-waterers, stall-mats, run-in-sheds, individual-turnout, group-turnout, grass-pasture, dry-lot, trails-on-site, trailer-parking, viewing-lounge, restrooms, rv-hookups, observation-room

### Program types (`programs[].type`)
summer-camp, clinic, lease, lessons, pony-party, therapeutic, day-camp

## 4. Owner UI

Owner dashboard gains structured tabs (web/src/app/owner/[slug]/...). Consolidated
to keep it Zillow-clean, not a wall of forms:

| Tab | Fields |
|---|---|
| **Boarding & Pricing** | `boardTypes` (multi-select chips) · `pricing` per type (from/to, included items) · `spotsAvailable` · `stallCount` · `acreage` · access policy |
| **Disciplines & Training** | `disciplines` accepted · `trainingTypes` · `trainingDisciplines` · `lessonLevels` · trainer policy (open/closed barn) |
| **Programs & Camps** | `programs` list editor — add/edit camp/clinic/lease/party entries (name, type, season, price, ages, capacity) |
| **Facility & Security** | `amenities` (expanded chips) · `securityFeatures` · `policies` |

- Existing **Listing** tab (`offering`, `priceFrom`) folds in: `priceFrom` becomes
  derived from `pricing`; `offering` stays as the card headline.
- Each multi-select = chips from the vocab + grouped headers. No freeform for
  filterable facets (keeps the vocab clean); freeform stays only for description.
- On save, the touched facet keys are added to `ownerEditedFacets`.
- API: one route per tab under `web/src/app/api/owner/businesses/[id]/...`, all
  going through the existing server-side merge in `web/src/lib/db/owner.ts`
  (validates against vocab, strips unknown slugs).

## 5. Public display

- **Detail page** (`web/src/app/business/[slug]/page.tsx`): grouped sections with
  icons — Boarding & Pricing table, Disciplines, Training & Lessons, Programs &
  Camps, Facility & Amenities, Security & Safety, Policies. Render only non-empty.
- **Card** (`StableCard.tsx`): badges for top discipline + board type + price +
  a 🎥 chip when `security-cameras` present.
- **Map API** (`web/src/app/api/map/route.ts`): include the filterable facet
  arrays in GeoJSON properties so map filtering is client-fast.

## 6. Search / map filters (the payoff)

Filter UI on `/search` + map: discipline · board type · price range ·
training type · lessons · "🎥 cameras" · "indoor arena" · "summer camp" ·
"open barn" · "spots available now".

- Backed by Postgres array containment on the GIN-indexed columns
  (`disciplines @> ARRAY[...]`, etc.) + `priceFrom`/`spotsAvailable` range.
- Query builder in `web/src/lib/db/search.ts`.

## 7. Crawler pre-fill

- `crawler/equine_crawler/facets.py` infers low-confidence facets from Google data
  (primaryType, types, editorialSummary keywords → e.g. "dressage" mention →
  disciplines+=dressage). Mostly owner-supplied; this just seeds.
- **Never overwrite owner edits:** crawler writes a facet column only if the key is
  not in `ownerEditedFacets` (and only fills, never clears). Mirror the existing
  attributes-merge protection.

## 8. Phasing & file inventory

1. **Data model** — schema columns + `facets.ts`/`facets.py` vocab + migration
   (+GIN indexes, hand-edited). No behavior change.
2. **Owner UI** — 4 tabs + API routes + `owner.ts` validators + OwnerNav.
3. **Public display** — detail sections + card badges + map-API properties.
4. **Filters** — search/map filter chips + `search.ts` query builder.
5. **Crawler pre-fill** — `facets.py` inference + only-if-not-owner-edited writes.

## 9. Open decisions
- Per-type pricing UI depth (simple "from" per type vs. from/to + included list).
- Whether `programs` warrants its own table later (start as JSON).
- Gate any facet behind paid tiers? (Recommend: all free during beta to drive
  claims; revisit at monetization.)
</content>
