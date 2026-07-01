# SEO, Camps, Pricing, Upsells & Email — Strategy (2026-07)

> Synthesizes and extends the existing specs (`growth-and-pipeline.md`,
> `monetization-tiers.md`, `keywords.md`, `website-builder.md`,
> `competitive-teardown.md`, `accounts-plan.md`) into decision-ready answers
> for five open questions. Where it disagrees with an existing number, the
> number here wins (and the source doc should be updated to match).
> Market comps pulled 2026-07-01: HorseClicks PRO Business $20/mo + $6.99/ad
> (classifieds, not barns); general local directories $29–99/mo; Angi Key
> membership ~$30/yr; Yelp enhanced profile ~$90/mo (ad-driven, not a listing
> fee — not directly comparable).

## 1. SEO

Infrastructure is already strong for this stage: programmatic
`/[category]/[state]/[county]/[city]` pages, `LocalBusiness` JSON-LD,
segmented sitemaps, FTS + trigram dedup, breadcrumb schema, and — critically
— a **noindex gate** (T18a) that keeps thin/unclaimed pages out of the index
until they clear a content-density bar. That gate is the single most
important piece of infra for scaling to 70k+ entries without a Panda-style
thin-content/doorway-page penalty. Priorities, in order:

1. **Tighten the index-eligibility bar before scaling.** At 3k listings a
   loose bar is fine; at 70k it isn't. Require ≥1 photo + a real description +
   full NAP + at least one grade-3 category before a listing page indexes.
   Same logic for geo×category hub pages: don't index empty or 1-listing
   combos (already the T18a intent — just enforce it strictly as coverage
   grows).
2. **Make templated copy non-duplicate at scale.** City-name mail-merge
   copy across thousands of near-identical hub pages reads as doorway pages
   to Google. Drive the unique text from *data* (amenity mix, price range,
   review snippets, discipline mix per city) rather than a single template
   with the city name swapped — the data model already has the facets to do
   this without hand-written content per page.
3. **Reviews are the cheapest unique-content engine you have.** Every
   approved review is unique, keyword-rich text tied to one listing —
   prioritize accelerating review collection (already planned in
   `accounts-plan.md` M7) specifically *for its SEO value*, not just trust.
4. **Backlink flywheel (biggest lever you haven't shipped yet).** The
   `website-builder.md` "Certified badge" + built-site backlinks are the
   highest-leverage SEO investment available: every claimed barn's own
   website/social bio linking back raises domain authority, which lifts
   *every* programmatic page at once. Pull this forward — it doesn't need
   the full website-builder product, just the `/api/badge/[slug].svg` +
   owner-dashboard "get your badge" panel.
5. **NAP consistency with Google Business Profile.** Local-pack visibility
   (map pack) is a separate, often higher-intent surface than organic —
   worth a lightweight GBP-sync check as coverage grows.
6. **FAQ schema on category/location hubs** (already on the Phase-2 list,
   T44) is cheap to ship and cheap real estate in the SERP — bring it
   forward alongside the badge work rather than leaving it for later.
7. **Camp-specific SEO surface is currently missing** — see §2.

## 2. Camp monetization (summer & winter)

Today's spec only has a generic `EVENTS` tier ($49/yr, includes camps) and a
one-line "$75/yr camp ad" note in `growth-and-pipeline.md`. That's a
placement, not a program. Build a real camp vertical:

- **Dedicated SEO surface:** `/camps/[state]/[city]` and a
  `/summer-camps/…` + `/winter-camps/…` split, separate from the boarding
  hubs — "summer horse camp near me" / "horse camp [city]" are high
  commercial-intent seasonal queries that a generic boarding page doesn't
  target. Add to `keywords.md`'s priority list.
- **Pricing ladder for camps specifically** (distinct from the general
  EVENTS unlock):
  - Listing a camp (dated, on the barn's own page) — included free once a
    barn holds the EVENTS tier; this is the upsell *into* EVENTS.
  - **Featured Camp Placement** — top of the camp-finder + camp hub pages +
    newsletter feature. Price seasonally, not flat: **$75/spring session,
    $150/prime-summer session** (3–4× the search volume of shoulder
    seasons), **$50/winter-break session**. This replaces the flat $75/yr in
    `growth-and-pipeline.md`.
  - **Pay-per-lead alternative** for smaller barns hesitant to prepay: $5–10
    per camp inquiry via the existing `Inquiry` model, capped/toggleable by
    the owner — de-risks the buy for a first-time advertiser.
- **Camp-finder quiz** (age, discipline, dates, budget) as a UI layer over
  the existing filter/Event infra — no new backend, meaningfully increases
  parent engagement and funnels into the existing `InquiryForm`.
- **Timing, given today is 2026-07-01:** summer-2026 camps are already
  running — too late to sell that season. Use the next 60–90 days to (a)
  build the winter-break camp vertical for a September email push, and (b)
  start the pre-sell motion for spring/summer 2027 camps in Jan–Feb 2027,
  since many barns finalize camp calendars by then. This is a scheduling
  note for the email program in §5, not a build blocker.

## 3. Yearly listing price (free unclaimed, forever)

**Keep the base claim free, forever — no paywall on core visibility.** This
is already locked in `roadmap.md` and is structurally required for the
SEO flywheel (§1) and for coverage/trust at 70k entries. Don't relitigate
it.

For the first paid tier (`VERIFIED` in `monetization-tiers.md`, currently
listed as $2.99/mo or $25/yr): **move to $29/yr, drop or de-emphasize the
monthly option** (or price it at $4.99/mo — high enough that annual is
obviously the better deal, which the owner UI already highlights).
Reasoning:
- $25–29/yr is priced to remove the objection, not to extract margin — the
  real revenue is upsells (§4), not tier 1. $29 is a cleaner, still-trivial
  price point (less than a bag of feed) that reads as a real product rather
  than a rounding artifact of $25.
- It resolves the inconsistency between `monetization-tiers.md` ($25/yr)
  and `roadmap.md`'s older $50/yr "Pro" note — treat $29/yr VERIFIED as the
  canonical number; update `roadmap.md` §Phase 2 to match.
- Napkin math at your stated scale target: 70,000 listings × a modest 6–10%
  claim-to-paid conversion × $29/yr ≈ **$122k–$203k/yr** from the base tier
  alone, before trainer seats, events, spotlight, or website builds. Coverage
  first, then claim rate, then this line, is the right order — don't
  price-gate claiming itself.

## 4. Upsells

Consolidated ladder (existing specs already cover most of this well —
prioritized here by effort vs. revenue, plus three additions):

| Upsell | Price | Status | Notes |
|---|---|---|---|
| VERIFIED (badge, photos, reviews, facets) | $29/yr | spec'd | see §3 |
| Trainer profile seat | $10/yr (2 free w/ TEAM) | spec'd | cheap, per-unit, low effort |
| Events/Camps unlock + featured camp | $49/yr + $50–150/season | spec'd, repriced §2 | |
| Spotlight (geo-featured, max 3/city) | $25/week | spec'd | scarcity-based, zero marginal cost, highest margin |
| Website build + hosting | $99–299 one-time + $49.99/yr | fully spec'd (`website-builder.md`) | biggest single ticket; build after claim base has volume, per that doc's own phasing |
| Pay-per-lead | $2–5/lead | on `tasks.md` (T46) | long-term, needs trust + volume |
| **Photography package** (new) | $150–300, partner-referral | not spec'd | photos are the #1 card-CTR driver per `competitive-teardown.md`; partner with local photographers, take a referral/booking fee rather than building a photo service in-house |
| **GBP sync/optimization one-time setup** (new) | $49–99 one-time | not spec'd | most small barns mismanage their Google Business Profile; low effort for us (NAP data already structured), high perceived owner value, and it *also* improves our own local-SEO signal (§1.5) |
| **Bundled "Pro" annual** (new) | ~$79/yr (vs. ~$98 à la carte) | not spec'd | package VERIFIED + 2 trainer seats + EVENTS into one bundle at a discount — cuts decision fatigue across a 4-tier ladder and lifts ARPU vs. owners who'd otherwise buy only VERIFIED |

## 5. Email marketing

This is the least-built-out area — `accounts-plan.md` covers transactional
mail (claim verification, saved-search digests, notifications) but there is
no marketing-email spec. Two separate audiences, two separate programs:

### A. Consumer (horse-owner) list
Built from: account signups, saved-search opt-ins, review submitters,
guest-inquiry submitters (add an opt-in checkbox at submission — currently
inquiries don't capture marketing consent).
- **Welcome series** on signup — "how to evaluate a boarding barn," nudges
  toward creating a saved search.
- **Saved-search digest** (already planned, `accounts-plan.md` M8a) — dual
  purpose: transactional + engagement.
- **Seasonal campaigns**: camp guide Feb–May (feeds §2's featured-camp
  revenue), fall "show season" content, boarding-season tips.
- **Monetization inside the newsletter**: "Featured Barn near you" slot,
  affiliate offers (feed/tack/insurance/trailers, per `growth-and-pipeline.md`
  §4), promoted camp slots — this is free inventory once the list exists.
- Cadence: monthly baseline, biweekly during camp season (Feb–May, Sept–Nov).

### B. Barn-owner list — the highest-ROI item missing today
The crawler already captures ~70k prospective owners' contact info before
anyone claims anything. **A cold "claim your free listing" nurture sequence
to crawled-but-unclaimed businesses is likely the single highest-ROI email
program available**, and it costs nothing to start (Resend is already a
dependency) — it doesn't need to wait on billing or scale milestones the way
§2–4 do.
- **Claim nurture**: "Your barn is already listed on [Directory] — claim it
  free" → 2–3 follow-ups over ~3 weeks → drives the coverage/trust flywheel
  directly (claimed listings are richer content = better SEO per §1, and are
  the top of the VERIFIED funnel per §3).
- **Upsell nurture** for already-claimed owners: feature-education drips
  timed seasonally (camp upsell Jan–Feb, spotlight/website-builder anytime).
- **Win-back** for lapsed VERIFIED subscriptions.
- **Response-rate nudges**: "3 unanswered reviews — reply now" (ties into
  the existing `responseRate` field).

### Infra & compliance notes
- **Split sending domains**: transactional (claim verification, alerts) on
  one Resend-verified subdomain, marketing/cold-outreach on another —
  protects the transactional domain's deliverability from marketing bounce/
  spam-complaint rates. Don't let a cold-outreach campaign risk the claim
  email actually landing.
- **Don't build an in-house ESP** — use Resend's audiences/broadcasts for
  segmentation rather than a bespoke `EmailCampaign` model at this stage.
- **Compliance**: unsubscribe link + List-Unsubscribe header on every send;
  cold outreach to a business's public contact address for a "claim your
  listing" notice is standard B2B practice, but still needs an opt-out and
  honest subject lines — no deceptive framing.
- **Metric that matters most**: claim-rate lift attributable to the cold
  nurture sequence — it's the number that moves both content quality (SEO)
  and tier-1 revenue (§3) at the same time.

## Sequencing note

Per `specs/tasks.md`, Phase 1 (MVP/Florida launch) isn't fully deployed yet
(T32/T34/T35/T35b open) and monetization is intentionally billing-OFF during
beta (`roadmap.md`). That's the right order for §3/§4. **§5's owner claim-
nurture sequence is the one item here that doesn't need to wait** — it's
free, uses infra that already exists, and directly compounds the coverage
goal this quarter.
