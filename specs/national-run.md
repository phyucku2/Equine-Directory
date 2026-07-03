# National Download Runbook — the organizing method

> How to finish the 48-state gosom download **without recreating the
> phantom-city mess**. Written 2026-07-03 after diagnosing the "Southwest
> Ranches, Floyd Co." homepage bug. Everything here runs on your machine
> (reaches Neon); the pipeline code referenced is already merged.

## What went wrong before (so it stays fixed)

Every gosom result inherited the county|state of the SEARCH QUERY that found
it (`#!#County|ST` tag). Google pads sparse rural queries with out-of-area
results, so a famous South-Florida barn returned by "horse boarding Floyd
County Indiana" was filed as Floyd County, IN — and the geocoder minted a
phantom "Southwest Ranches" city there with FL coordinates. Six wrong queries
→ six phantom "Southwest Ranches" rows → six duplicate homepage tiles with
wrong county labels.

**The fix (merged):** the pipeline now trusts the listing's own evidence over
the query tag — its address's state code first, its coordinates against state
centroids second (`equine_crawler/pipeline/geo_validate.py`). The geocoder
also refuses to create/file into a county whose state is >750 km from the
listing (defense in depth), and the last-resort global name match rejects
far-away hits. The web read path additionally dedupes same-named nearby
cities so visitors never see duplicate tiles even if data is briefly dirty.

## Order of operations

1. **Pull latest `main`** in both `crawler/` and re-`pip install -r
   requirements.txt` if needed. Confirm the fix is present:
   `python -m pytest tests/ -q` → all green (includes the FL-barn-from-
   Indiana-query regression test).

2. **Repair the existing data once** (before ingesting anything new):
   ```bash
   python repair_locations.py            # dry run — review the printout + out/*.csv
   python repair_locations.py --apply    # merge phantom cities, re-point stragglers
   ```
   Pass 1 merges displaced city rows (coords >750 km from their filed state)
   into the real same-named city; Pass 2 re-points individually mis-filed
   businesses. Anything without a safe target is left in place and listed in
   the CSVs for manual review.

3. **Ingest state by state** (existing flow, now self-validating):
   ```bash
   python gen_gmaps_queries.py                       # queries with #!#County|ST tags
   # run gosom per state batch (run-national.ps1 / docker command in
   # specs/growth-and-pipeline.md §2)
   python run.py --source gmaps-file --file out/results-<ST>.json
   ```
   Out-of-area results now file under their TRUE state automatically (or are
   snapped to the nearest real city by coordinates).

4. **Audit after each few states**: `python audit.py` — the location-mismatch
   count should stay ~0 now. If it grows, stop and look before continuing.

5. **Classify + publish**: `python sort.py` (the Sonnet sorter) as before;
   work `/admin/review` for the grade-1/2 queue.

6. **Refresh the site**: the crawl workflow's revalidate ping (or wait for
   ISR). Spot-check the homepage "Cities near you" — one tile per city, right
   county labels.

## Definition of done (per state)

- `audit.py` location-mismatch = 0 for the state
- published count for the state looks sane vs. the gosom row count
- a spot-check city page shows "City, ST" with the right state

## After the 48 states

- Re-run `repair_locations.py` once more (belt and braces), then
  `audit.py` full pass.
- Sitemaps pick up new cities automatically (ISR); Search Console will show
  the discovered-URL count climbing on its own.
