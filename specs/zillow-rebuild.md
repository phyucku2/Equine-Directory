# Zillow-style rebuild — map-first directory (mobile)

> Goal: rebuild the browse/search experience to mirror Zillow's mobile app — a
> full-screen map with a dot per stable, a draggable bottom sheet that toggles
> map ⇄ list, and a persistent bottom tab bar. 80%+ mobile, so this is the
> primary surface.

## Reference notes (from Zillow mobile screenshots)

### Top bar
- Single **location search** ("Okeechobee, FL") with a saved-searches badge and a filter (sliders) icon.
- **Filter chips** row directly under search: `Home type (1) ▾`, `10 acre+ lot…` — active filters surface as removable chips. (Ours: stable **type/category**, **distance**, **$-level**, **amenities**.)

### Map (the hero)
- Full-bleed map; **one red dot per listing**, clustered when zoomed out.
- **Map controls** (left rail): layers toggle, draw route, **draw-your-own boundary**, locate-me (GPS).
- **"Save Search"** button floating on the map.
- Tapping a dot → highlights it and surfaces its card in the sheet.

### Bottom sheet (map ⇄ list)
- Draggable sheet with a **count header**: "**49 homes for sale**".
- Swipeable **listing cards**: photo carousel + "2 days on Zillow" freshness badge + ❤️ save, **price (large)**, key specs ("43 ac lot | Lot/Land for sale"), address, ⋯ menu.
- Drag up = list view; drag down = map. Same data, two views.

### ⭐ Bottom tab bar (5 tabs) — *you asked me to note these*
| Zillow tab | Icon | Our equivalent |
|---|---|---|
| **Search** | 🔍 magnifier | **Search / Map** — the map+list of stables (primary) |
| **Updates** | 🔔 bell | **Alerts** — new listings / saved-search updates (Phase 2) |
| **Favorites** | ♡ heart | **Saved** — favorited stables (localStorage v1 → account later) |
| **Plan** | ✓ clipboard | **Browse** — by category (boarding/farrier/vet/tack/feed) |
| **Inbox** | 💬 chat | **Inbox** — owner inquiries / contact (ties to lead-gen, Phase 2) |

**Our v1 tab bar (lean, all functional today):**
`Search/Map · Browse (categories) · Saved · List your barn`
→ grow to the full 5 (Alerts, Inbox) as accounts + lead-gen land.

> Note: a global bottom tab bar overlaps the stable-detail sticky action bar
> (Call/Directions/Website) — reconcile by stacking the action bar above the
> tabs, or hiding tabs on detail pages.

## What we already have
- Every listing has lat/lng; location drill-down + categories + search API exist.
- BusinessCard is close to the Zillow card (photo, name, rating, location, badge).

## Prerequisite (foundational) — exact coordinates
The crawler currently stores the **city-centroid** lat/lng, so every stable in a
city would stack on one dot. Fix: capture Google Places' **exact** coordinates
per listing (done in the crawler), then re-crawl. Until then, dots cluster at
city centers.

## Build plan
1. **Exact coords** in the pipeline (crawler) — *done*; needs a re-crawl to populate.
2. **Map library:** MapLibre GL JS (open-source, free) with clustering. MVP can use
   MapLibre's free demo tiles (no key); upgrade to a MapTiler free key for
   production-grade tiles. (Alt: Google Maps JS — we have a key, but per-load cost.)
3. **`/search` (or `/map`) rebuild:** full-screen map + dot-per-stable + clustering;
   draggable bottom sheet with count + swipeable cards; map⇄list toggle; "near me".
4. **Filter chips** row (type, distance, $-level, amenities) feeding the existing filter API.
5. **Bottom tab bar** (v1: Search/Map · Browse · Saved · List your barn).
6. **Saved** stables via localStorage (no auth needed for v1).

## Filters (Zillow "Filters" screen → our adaptation)
Zillow's filter sheet: segmented type toggle (For sale/rent/sold), **Price range**
with a histogram + dual-handle slider + Min/Max inputs, **Reset** (top-right), and a
live **"See N results"** button that updates as you adjust. Map it to us:

| Zillow filter | Our filter |
|---|---|
| For sale / rent / sold (segmented) | **Service type** segmented: All · Boarding · Training · Farrier · Vet · Tack · Feed |
| Price range (histogram + slider) | **Distance** slider ("within X mi" + "near me"); **$-level** ($–$$$$) *when we add pricing* |
| (beds/baths/lot) | **Amenities** checkboxes: arena (indoor/outdoor), # stalls, turnout, wash rack, trailer parking, trails |
| — | **Rating** (4★+ / 3★+), **Verified only** toggle |
| Save Search | Save Search (Phase 2) |
| **See 47 results** | **See N stables** — live count via the existing `/api/filter`, then apply |

Notes: we have **no price field yet**, so lead the slider with **distance** (most
relevant for stables) and add **$-level** once owners set it (a Pro-tier input).
Filters live as a **bottom sheet** on mobile; chips summarize active filters on the
map/search header.

## Not now (Phase 2)
Alerts/saved-search engine, Inbox/messaging (lead-gen), account-backed favorites,
draw-your-own-boundary search.
