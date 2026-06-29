# Growth Strategy, Data Pipeline & Monetization — Roadmap

Long-term plan: **SEO-first traffic engine → audience → layered revenue → SaaS.**
The directory's job first is organic traffic; monetization follows the audience.

## 1. The flywheel (order matters)

1. **Coverage** — scrape every US barn (local gosom pipeline, below) → the most
   complete equine directory.
2. **SEO traffic** — programmatic, crawlable pages per state/county/city/discipline
   → rank for "horse boarding near me", "[city] horse boarding", "[discipline]
   barns [state]". Free + public (never gate content behind login — crawlers and
   users must see it).
3. **Audience** — capture horse-owner visitors (saved searches, alerts, email
   capture) → the asset every revenue stream monetizes.
4. **Revenue** — see §4.
5. **SaaS** — a stable/barn-management app for managers (long-term, §5).

## 2. Data pipeline — local gosom scraper (one pass, no cap)

Replaces the per-page Google Places grind (which caps at 20/search) with a
self-hosted scraper the user runs locally via Docker. Free software; full
pagination via scroll depth.

**Flow:**
1. Generate `queries.txt` — one search per line, from our county list × boarding
   phrases (reuse `registry` areas across all 48 states).
2. Run gosom in Docker locally:
   ```bash
   docker run -v gmaps-cache:/opt -v "$PWD/queries.txt:/queries.txt:ro" \
     -v "$PWD/out:/out" gosom/google-maps-scraper \
     -input /queries.txt -results /out/results.json -json \
     -depth 20 -c 8 -exit-on-inactivity 3m
   ```
   (Add `-proxies '...'` for scale to avoid Google blocking; datacenter IPs get
   throttled, so residential proxies for large national runs.)
3. **Ingest into OUR schema** via a new crawler source `gmaps-file`: `run.py
   --source gmaps-file --file out/results.json`. We do NOT use gosom's `-dsn`
   direct write (it writes its own shape) — we run gosom's JSON through our
   existing pipeline so we get geocoding (resolve_or_create by county+state),
   facet inference, category grading, non-barn filtering, dedup, and our
   moderation queue. Run on the user's machine (reaches Neon).

**Field mapping (gosom JSON → RawListing):** name→name, full_address→address,
phone→phone, site→website, latitude/longitude→lat/lng, rating→rating,
reviews→rating_count, category/categories→types, place_id→external_id
(`google:<place_id>`), working_hours→hours, business_status (skip CLOSED).

**Why local:** $0 per-record (vs Outscraper ~$1-3/1k, Google ~$15-47/1k),
no 20-cap, full control. Trade-off: we run/maintain it + proxy cost at scale.
Keep Google Places API as the sanctioned incremental refresh.

## 3. SEO architecture (traffic-first)

- **Programmatic pages:** `/horse-boarding/[state]/[county]/[city]` +
  discipline crossings (`/dressage-barns/[state]`), each a unique, indexable
  page with the local listings, intro copy, and internal links.
- **Schema.org** `LocalBusiness`/`EquestrianFacility` JSON-LD per listing (we
  already have `SeoMetadata`); rich snippets.
- **Sitemaps** per state (the directory already has a sitemap route — extend to
  the new programmatic pages).
- **Content:** county/city landing copy, "how to choose a boarding barn", camp
  guides — long-tail SEO surface.
- **Public, fast, mobile** — no login walls on content; geolocation "near you".

## 4. Monetization (built behind the existing Subscription/Purchase models)

The accounts system already has `Subscription` (FREE/PRO/PREMIUM) + `Purchase`
(one-off ledger) + `BILLING_ENABLED` flag. Map the streams onto it:

| Stream | Price | Model | Implementation |
|---|---|---|---|
| **Claimed listing** | **$25 / yr** | Subscription (new tier, e.g. `LISTED`) | claim → pay → verified badge, edit access, more photos, facets, lead inbox |
| **Website build** | **$99–299 build + $49.99 / yr maint.** | Purchase (one-off) + Subscription (maint.) | lead form on owner dashboard → service; could auto-generate a one-page site from their listing facets |
| **Camp advertising** | **$75 / yr** | Purchase / Subscription | featured camp placement on regional + camp-finder pages (seasonal) |
| **Email sales to visitors** | — | audience | consumer email capture (saved searches/alerts already exist) → newsletters, partner offers, affiliate (feed, insurance, trailers), promoted barns |

- **Beta:** keep billing OFF (free claims) to drive coverage + claims; flip on
  once audience + claimed base are meaningful.
- **Free for horse-owners forever** (Zillow model) — consumers never pay; owners
  and advertisers do.

## 5. Future — Stable/Barn management app (SaaS for managers)

The premium long-term layer: a manager-facing app to RUN the barn (not just be
listed). Sketch:
- Boarder roster, stalls/availability, billing & autopay, feed/turnout/med
  schedules, farrier/vet calendars, document storage (Coggins/insurance),
  staff tasks, owner messaging.
- Ties back to the directory: a managed barn's availability + facets stay
  auto-current → best listings → reinforces the flywheel.
- Pricing: per-barn monthly SaaS (the real revenue tier).
- Build only after the directory + audience are established; it's a separate app
  sharing the same accounts/identity.

## 6. Phasing
1. **Now:** owner facets (in progress) → richer claimable listings.
2. **Next:** gosom local pipeline → national coverage at $0/record.
3. **Then:** programmatic SEO pages + sitemaps + schema.org → traffic.
4. **Then:** turn on claim billing ($25/yr) + camp ads + website-build leads.
5. **Then:** consumer email funnel.
6. **Later:** barn-management SaaS.
