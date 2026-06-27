# Competitive Teardown — Directory UX (mobile-first)

> Source: examined ~10 housing/apartment directories (Zillow, Apartments.com,
> Zumper, Trulia, Realtor.com, Redfin, HotPads, PadMapper, Apartment List,
> Rent.com) and ~10 animal/pet directories (Petfinder, Adopt-a-Pet, Rover, Wag,
> AKC Marketplace, Good Dog, Chewy, BringFido, Yelp pet services, Care.com).
> **Assumption: 80%+ of traffic is mobile — mobile-first is the lens for all of this.**

## Convergent playbook (both categories agree)
1. **"What + Where" hero** — service/type + location only; attributes come later (Yelp Find/Near, Rover, Zillow).
2. **List ⇄ Map toggle** — the product is a *place*. Mobile = map-first with a swipeable bottom card tray (Zillow, PadMapper, Rover, Yelp).
3. **Geo × service SEO grid** — `/{service}/{state}/{city}` with count/year-bearing H1s ("Horse Boarding in Ocala, FL — 28 stables, updated 2026"). Highest-ROI growth pattern in both categories.
4. **Converged card fields** — photo · name · city + distance · ⭐rating + review count · $-level · category tag · one verification badge · "responds in ~X."
5. **Reviews are the moat** — even Chewy outsources reviews to Yelp. Trust > inventory scale.

## Our starting point
Data model is already rich (`amenities[]`, `attributes`, `hoursOfOperation`, `verificationBadge`, `rating`/`reviewCount`, claim flow) and the geo×category route already exists (`/[category]/[state]/[county]/[city]`). Much of this is *surfacing what we have*.

## Design (UX / interaction — mobile-first)
- Map ⇄ list toggle; mobile map-first + bottom card tray. (Biggest gap — no map today.) — **Large**
- Filters as a bottom sheet (service type, distance, $-level, amenities) + one-tap "near me". — **Med**
- Sticky bottom action bar on detail: Call · Directions · Request Info. — **Small**
- Hero = what + where, sticky on results. — **Med**
- Fix mobile nav (we hide "Florida" on small screens). — **Small**

## Information (data / IA / trust)
- Card upgrades: distance, $-level pricing, "Responds in ~X". — **Med** (needs data)
- Trust stack: human-verified badge · review count · "Owner-managed/Claimed" · credentials (Coggins/insurance/trainer certs). — **Med**
- Reviews system with 5★ distribution. — **Large**
- Surface facility amenities as structured fields + filters (arena, # stalls, turnout, wash rack, trailer parking, footing, disciplines). — **Med**
- Templated geo×service H1s + breadcrumb/internal-link mesh. — **Med, high ROI**
- Detail page order: gallery → name/rating/badges → board+training options + pricing → about → amenities → map → reviews → contact CTA. — **Med**

## Presentation (visual)
- Photo-forward real imagery (Rover green, Care 2025 warm naturals validate our rustic-premium palette). Listings need photos; strong placeholders meanwhile.
- Emphasize price + rating in the type scale.
- Count/year H1s for freshness.

## Skip / defer (too heavy for a small directory)
In-platform booking/escrow, background-check infra, live GPS/report cards, MLS-style data layers, AI assistants. Substitute: owner-claim + manual verification + contact-form inquiry, and explicit sort by distance/rating/price.

## Roadmap (mobile-first, ROI-weighted)
1. **Now:** templated geo×service H1s + internal linking; mobile nav fix; sticky detail action bar; card field groundwork.
2. **Next:** map+list toggle (mobile-first) + filter bottom sheet + amenity filters; detail-page reorder.
3. **Later:** reviews collection (the moat); saved-search alerts; "find a stable" matcher quiz.
