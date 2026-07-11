# Monetization Tiers & Entitlements — Spec

Owner tiers + add-ons, gated by a single entitlements layer. All gating reads from
`getEntitlements(business)` so features can move between tiers via config without
touching gate logic. Billing stays behind `BILLING_ENABLED` (off in beta — admin
manual-grants tiers); the plumbing is built now.

## Tiers (cumulative ladder) + add-on

| Tier (SubTier) | Price | Unlocks (on top of lower tiers) |
|---|---|---|
| **FREE** | $0 | crawled/claimed basics: name, map pin, category, hours, public reviews *display*. No owner photos/logo, no review collection, no facet editing. |
| **BASIC** (entry, Goal 6) | **$9.98/yr** | own your listing: **1 owner photo** · **outbound website link** on the public listing · **inquiry/lead delivery** (the customer's message lands in the owner's inbox). No badge/logo/review collection/facet editing — those stay Verified+ so the ladder holds. |
| **VERIFIED** (Tier 1) | **$2.99/mo or $25/yr** | verified badge · **5 owner images** · **1 logo** · **"Stalls Available" badge** overlay on images · **collect + respond to reviews** + show ratings · **edit rich facets** (disciplines/board/pricing/amenities/security/programs) · lead inbox |
| **TEAM** (Tier 2) | Tier 1 + **$10/yr per trainer** | **trainer profiles** — **2 seats included**, +$10/yr each beyond 2. Trainer = name + 1 photo + bio (+ disciplines, certs, contact). Public trainer pages. |
| **EVENTS** (Tier 3) | Tier 2 + (config, ~$49/yr) | publish **events/shows/clinics/camps** (dated) → public **event pages + calendar** |
| **SPOTLIGHT** (Tier 4, add-on) | **$25/week** | geo-targeted **featured placement** in the barn's **town/city**; **max 3 per city**, auto-rotate weekly |

Pricing lives in `web/src/lib/entitlements.ts` as cents config (easy to change):
`{ basic: { yearly: 998 }, verified: { monthly: 299, yearly: 2500 }, trainerSeat: { yearly: 1000 }, events: { yearly: 4900 }, spotlight: { weekly: 2500 } }`.

### Lead capture — the Zillow model (keep visitors on-site)
Consumer inquiries are the core paid value, and they keep the visitor on the
directory rather than sending traffic away:
- **Capture is always free + on-site.** Every listing shows a "Contact this
  stable" form (`InquiryForm`); the lead is stored for every barn regardless of
  tier. "Contact" is the **primary** CTA; the outbound website link is demoted to
  a small `rel="nofollow sponsored"` text link so clicks don't leak off-site.
- **Delivery + reading is the paid perk** (`canReceiveLeads`, BASIC+). Entitled
  barns get the email alert and can read/reply in the owner inbox. For FREE owners
  the lead PII is **redacted server-side** (name/email/phone/message never reach
  the browser) and the owner inbox shows locked placeholder cards with an "Upgrade
  to read" CTA — a real paywall, not a CSS blur. FREE/unclaimed barns' leads are
  **held**, and the public listing shows a **"N inquiries waiting — claim to read"**
  upsell. The claim→convert funnel then reinforces it: the owner dashboard shows a
  "You have N inquiries waiting" banner and the Plan screen headlines "Unlock your
  N waiting inquiries." The consumer's experience is identical either way (we never
  reveal a barn is unclaimed).
- **The embeddable badge stays free for any *claimed* barn** (owner dashboard):
  every badge on a barn's own site is a backlink to us, so we spread it as widely
  as possible rather than gating it.

## Entitlements resolver

`web/src/lib/entitlements.ts`:
```ts
type Entitlements = {
  tier: SubTier;
  maxImages: number;      // FREE 0, VERIFIED+ 5
  canLogo: boolean;       // VERIFIED+
  stallsBadge: boolean;   // VERIFIED+
  canCollectReviews: boolean; // VERIFIED+ (display is always public)
  canEditFacets: boolean; // VERIFIED+
  maxTrainers: number;    // TEAM: 2 + subscription.trainerSeats
  canEvents: boolean;     // EVENTS
  spotlightActive: boolean;       // any active Spotlight row covering now
  spotlightLocationId: string | null;
};
getEntitlements(business): Entitlements  // from subscription.tier + trainerSeats + active Spotlight
```
A FREE/unclaimed barn still *displays* crawler-inferred facets + public reviews
(SEO); the owner just can't *edit*/collect until VERIFIED (clean upsell).

## Data model (web/prisma/schema.prisma)

- `enum SubTier` — **add** `VERIFIED`, `TEAM`, `EVENTS` (keep existing values; additive).
- `Subscription` — add `trainerSeats Int @default(0)`.
- `BusinessImage` — add `isLogo Boolean @default(false)`.
- **`Trainer`** — id, businessId(→Business), name, slug, bio?, photoUrl?, disciplines String[], certifications String[], email?, phone?, rank Int, timestamps. `@@unique([businessId, slug])`, `@@index([businessId])`.
- **`Event`** — id, businessId(→Business), type (program-type vocab: show/clinic/summer-camp/…), title, slug, description?, startDate, endDate?, price Int?, registrationUrl?, locationId? (→Location, for SEO/geo), imageUrl?, isPublished Boolean @default(true), timestamps. `@@unique([businessId, slug])`, `@@index([businessId])`, `@@index([startDate])`.
- **`Spotlight`** — id, businessId(→Business), locationId(→Location, city scope), startsAt, endsAt, weeklyRateCents Int @default(2500), status String @default("active"), purchaseId?, timestamps. `@@index([locationId, status])`, `@@index([businessId])`.
- Back-relations on Business (`trainers`, `events`, `spotlights`) and Location (`spotlights`).
- **Migration:** hand-authored, additive. `ALTER TYPE "SubTier" ADD VALUE IF NOT EXISTS …` for the 3 new values; ADD COLUMNs; CREATE TABLEs + indexes. **Do NOT drop** the trigram GIN indexes (idx_business_name_trgm/address) or the facet GIN indexes — additive only.

## Enforcement (server-side, every gate via getEntitlements)
- Image upload route: reject when owner image count ≥ `maxImages`; logo upload requires `canLogo` (and sets `isLogo`, max 1).
- Facet edit routes (the 4 owner facet tabs): require `canEditFacets`.
- Review collection/response routes: require `canCollectReviews` (display stays public).
- Trainer create: reject when trainer count ≥ `maxTrainers` (prompt to add a seat).
- Event publish: require `canEvents`.
- Stalls-Available badge overlay on images: render only when `stallsBadge`.

## Owner UI (web/src/app/owner/[slug]/…)
- **Plan/Upgrade** tab — shows current tier, what each unlocks, monthly/annual toggle (annual highlighted), trainer-seat counter, Spotlight purchase (city + weeks). Checkout via Stripe when `BILLING_ENABLED`, else "request access" / admin-granted.
- **Trainers** tab — manage trainer profiles (name, photo, bio, disciplines, certs); seat usage indicator.
- **Events** tab — manage events/shows/camps (dated).
- **Logo** upload + image manager respecting the 5-image quota + stalls-badge toggle.
- Gated tabs show an upgrade prompt instead of the editor when the entitlement is missing.

## Public display
- **Logo** on the listing header + card; **"Stalls Available" badge** overlaid on the primary image when entitled + spots open.
- **Trainer pages**: `/business/[slug]/trainers` + individual trainer view (1 photo + bio + disciplines) — SEO surface.
- **Event pages + calendar**: `/events/[…]` per event (dated, schema.org Event JSON-LD) + a barn's events on its listing; feeds the camp-finder.
- **Spotlight placement**: featured slot at top of the city/town search + map + "featured near you"; max 3 active per city, auto-rotate weekly (round-robin by `startsAt`).
- Reviews: display always public; "leave a review" / owner responses only when the barn is `canCollectReviews`.

## Billing (Stripe, behind BILLING_ENABLED) + admin
- Products/prices: Verified (monthly $2.99 / yearly $25), Trainer seat (yearly $10, quantity = trainerSeats), Events (yearly, config), Spotlight (weekly $25, per city). Extend the existing `Subscription`/`Purchase` + Stripe scaffolding from the accounts system.
- Checkout sessions + webhook → set `Subscription.tier`/`trainerSeats`, create `Spotlight`/`Purchase` rows.
- **Beta:** billing off; an **admin** action grants a tier / seats / spotlight manually (extend the admin area). Spotlight rotation + expiry handled by a scheduled check (or on-read filtering by now ∈ [startsAt,endsAt] and ≤3/city).

## Build phases (ultracode)
1. Schema + `entitlements.ts` (config + resolver) + migration.
2. Enforcement + owner UI (Plan/Upgrade, Trainers, Events, Logo, gated facet/review/image routes).
3. Public display (logo, stalls badge, trainer pages, event pages + calendar, spotlight placement).
4. Billing (Stripe products/checkout/webhooks behind flag) + admin manual-grant + spotlight rotation.
5. Verify (prisma generate, tsc, lint, pytest).
