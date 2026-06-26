# The Stable Directory — End-to-End Roadmap

> Single source of truth so we stop firefighting and build against a plan.
>
> **Decisions (locked 2026-06-26):**
> - **Scope:** **Broward beta first** → then Florida metros → then national.
> - **Monetization:** **build** owner accounts + tiers, but **free during the beta
>   period** (no charging until we flip billing on post-beta).
> - **Primary UX:** **SEO pages + Zillow map (both)** — organic discovery *and* app feel.
> - **Design:** clean white/black, **lighter-blue accent (`#3b82f6`)** — deliberately
>   distinct from Zillow's trademark blue (`#006AFF`).
> - **Catalog:** **V1 = stables/barns (boarding) only**; other crawled data retained, hidden.

## Vision
A clean, mobile-first (80%+), Zillow-style directory of horse **stables/barns** —
**free for horse owners**, monetized via barn-owner tiers + advertising. Florida-
first, continuous data via Google Places.

---

## Phase 0 — Unblock the foundation (you, in dashboards)
These block everything; both are config, not code.
1. **Production deploy:** tick **`DATABASE_URL`** for the **Production** environment → Redeploy. (`vercel-build` = `prisma generate && next build`; it reads the DB at build.) Confirm prod serves the redesign.
2. **Map key:** enable **Maps JavaScript API**, create a **website-restricted** key, add **`NEXT_PUBLIC_GOOGLE_MAPS_KEY`** (Prod + Preview) → Redeploy → Google map renders.

## Phase 1 — V1 launch: clean stables directory (Broward) — *my build focus*
1. **Stables-only scoping (the real gap).** Today only `/api/map` filters to
   `horse-boarding`; homepage featured/categories, `/api/search`, and category/geo
   hubs still show all categories. Add one shared boarding/facilities filter reused
   across `web/src/lib/db/*` (business/search/category) so the whole public site is
   stables-only. Keep other data in the DB.
2. **Map polish:** dot↔card sync (tap dot → highlight its card), green cluster
   styling, exact coordinates (needs a re-crawl to backfill), near-me.
3. **Design tidy:** the token retheme already cleaned most surfaces; verify cards,
   location/detail/search pages, fix any leftover rustic bits.
4. **Data quality:** re-crawl Broward (`places`, `seed`) to backfill exact coords;
   prune non-Broward / mis-tagged entries; confirm the ~73 stables are clean.
5. **Auto-refresh:** wire **`REVALIDATE_URL` + `REVALIDATE_SECRET`** into the crawl
   workflow so the live site updates after each crawl (no manual redeploy).
6. **SEO:** unique per-location/category copy; titles/sitemap/structured-data exist.
**Launch when:** production live, Google map working, Broward stables clean, mobile-first.

## Phase 2 — Owner accounts + monetization (built during beta, billing OFF)
> Build the full claim → account → tier machinery so owners can claim and manage
> listings during the beta, but **do not charge** — Stripe stays in test/disabled
> until we flip billing on after the beta period.
1. **Auth:** barn-owner accounts (magic-link / NextAuth). Consume the existing
   `ClaimRequest.verificationToken` → create an owner account linked to the Business.
2. **Email:** Resend/SendGrid for claim verification + notifications (currently deferred).
3. **Owner dashboard:** edit listing, **amenity tick-boxes** (`amenities[]`/`attributes`),
   photo upload (paid), respond to reviews.
4. **Stripe tiers** (schema already supports `isFeatured`/`featuredUntil`/`PREMIUM`):
   - **Free (claimed)** — Google photo (live Places Photo + attribution), basic info
   - **Pro $50/yr** — own photos, Verified badge, analytics, priority
   - **Add-ons** — featured placement, trainer profile ($50/yr), camp ad ($75/season), hosted microsite ($199/yr)
   - Webhooks set tier/badge/featured.
5. **Reviews:** collection + moderation + owner responses (the trust moat).

## Phase 3 — Continuous data + expansion
1. **Schedule the crawl** (cron) → continuous stream; idempotent upserts; grow the
   `areas` list (Broward → FL metros → states).
2. **National framing** once the brand/name is finalized; soft geo-personalization
   via Vercel edge headers — never hard-redirect.
3. **Re-enable other categories** (farrier/vet/tack/feed) as their own category
   "directories" — the data is already collected, just hidden.
4. **Scale levers:** distance/amenity filters, saved searches/alerts, image pipeline,
   and **paid lead-gen** (owner inquiries — the biggest eventual revenue lever).

---

## Hard-won guardrails (don't regress)
- **No `prisma migrate deploy`/`seed` in the Vercel build** — it caused concurrent-
  build failures; migrations/seed run in the crawl workflow instead.
- **Keep the horse-owner side free** (Zillow model); monetize barns + advertisers.
- **Google Places photos** are a live fetch with attribution — can't be stored as owned.
- **Map:** Google Maps (MapLibre wouldn't render on iOS Safari).

## Immediate next actions
- **You:** Phase 0 (DATABASE_URL → Production; Google Maps key).
- **Me:** Phase 1 #1 (site-wide stables-only scoping) + #5 (revalidation wiring),
  then re-crawl for clean coords, then map/design polish.
