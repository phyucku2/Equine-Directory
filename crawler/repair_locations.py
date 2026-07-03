#!/usr/bin/env python3
"""Repair cross-state mis-filed listings and phantom duplicate city rows.

The phantom-city bug (see equine_crawler/pipeline/geo_validate.py): gosom
results inherited the county|ST of the query that returned them, so a South-
Florida barn returned by an Indiana county's query minted a "Southwest Ranches"
city row under Floyd County, Indiana — with Florida coordinates. The homepage
then showed six "Southwest Ranches, <wrong> Co." tiles.

This tool fixes the DATA the old pipeline created (the pipeline itself is fixed
by geo_validate; new ingests can't recreate the mess):

  Pass 1 — displaced CITY rows: any city whose own coordinates lie more than
    VETO_KM from its parent state's centroid. For each, the true state is
    derived from the city's coordinates; its businesses/events/spotlights are
    moved to the same-named (or nearest) real city in the true state, and the
    emptied phantom row is deleted.

  Pass 2 — displaced BUSINESSES: published businesses whose own coordinates lie
    more than VETO_KM from their filed state's centroid (covers rows attached
    to a correctly-placed city in the wrong state by the old global name
    match). Re-pointed to the nearest city in their true state.

Read-only by default: prints a summary and writes offender CSVs to out/.
Run with --apply to execute the moves/merges (each phantom city in its own
transaction). From the crawler folder, DATABASE_URL set:

    python repair_locations.py            # dry run + CSVs
    python repair_locations.py --apply    # fix the data

After an --apply run, ping the site's revalidate endpoint (or wait for ISR) so
the fixed labels show.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

from dotenv import load_dotenv

from equine_crawler.db import connect, gen_id
from equine_crawler.pipeline.geo_validate import (
    VETO_KM,
    nearest_state,
    state_distance_km,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OUT = Path("out")

# How far a "same city, right state" match may be from the phantom's coords and
# still be treated as the same physical place. Phantom rows carry the exact
# coordinates of a barn IN the real city, so the true city row is always close.
SAME_CITY_KM = 50.0


def _rows(cur, sql, args=()):
    cur.execute(sql, args)
    return cur.fetchall()


def find_displaced_cities(cur) -> list[dict]:
    """CITY rows whose coords are nowhere near their parent state's centroid."""
    rows = _rows(
        cur,
        """
        SELECT city.id, city.name, city.slug, city.latitude, city.longitude,
               co.name AS county, st.code AS state,
               (SELECT count(*) FROM "Business" b WHERE b."locationId" = city.id) AS biz
        FROM "Location" city
        JOIN "Location" co ON city."parentId" = co.id AND co.type = 'COUNTY'
        JOIN "Location" st ON co."parentId" = st.id AND st.type = 'STATE'
        WHERE city.type = 'CITY' AND city.latitude IS NOT NULL
        """,
    )
    displaced = []
    for cid, name, slug, lat, lng, county, state, biz in rows:
        lat, lng = float(lat), float(lng)
        km = state_distance_km(state, lat, lng)
        if km is None or km <= VETO_KM:
            continue
        true_state = nearest_state(lat, lng)
        displaced.append(
            {
                "id": cid, "name": name, "slug": slug, "lat": lat, "lng": lng,
                "filed_county": county, "filed_state": state,
                "distance_km": round(km), "true_state": true_state, "businesses": biz,
            }
        )
    return displaced


def find_target_city(cur, name: str, true_state: str, lat: float, lng: float, exclude_id: str):
    """The real city this phantom duplicates: same name in the true state within
    SAME_CITY_KM, else the nearest city in the true state (any name)."""
    rows = _rows(
        cur,
        """
        SELECT l.id, l.name, l.latitude, l.longitude
        FROM "Location" l
        JOIN "Location" co ON l."parentId" = co.id
        JOIN "Location" st ON co."parentId" = st.id
        WHERE l.type = 'CITY' AND st.type = 'STATE' AND upper(st.code) = upper(%s)
          AND l.latitude IS NOT NULL AND l.id <> %s
        ORDER BY lower(l.name) = lower(%s) DESC,
                 (l.latitude - %s) * (l.latitude - %s)
                 + (l.longitude - %s) * (l.longitude - %s) ASC
        LIMIT 1
        """,
        (true_state, exclude_id, name, lat, lat, lng, lng),
    )
    if not rows:
        return None
    tid, tname, tlat, tlng = rows[0]
    # Same-name matches must actually be nearby; nearest-any-name always OK.
    if tname.lower() == name.lower():
        dx = (float(tlat) - lat) * 111.0
        dy = (float(tlng) - lng) * 96.0  # ~km/deg lng at mid-US latitudes
        if (dx * dx + dy * dy) ** 0.5 > SAME_CITY_KM:
            return None
    return (tid, tname)


def merge_city(cur, phantom_id: str, target_id: str) -> tuple[int, int, int]:
    """Move everything from the phantom row to the target, delete the phantom."""
    cur.execute(
        'UPDATE "Business" SET "locationId" = %s WHERE "locationId" = %s',
        (target_id, phantom_id),
    )
    biz = cur.rowcount
    cur.execute(
        'UPDATE "Event" SET "locationId" = %s WHERE "locationId" = %s',
        (target_id, phantom_id),
    )
    ev = cur.rowcount
    cur.execute(
        'UPDATE "Spotlight" SET "locationId" = %s WHERE "locationId" = %s',
        (target_id, phantom_id),
    )
    spot = cur.rowcount
    # SeoMetadata rows cascade on delete — phantom cities never earned one, but
    # clear defensively so the DELETE can't take content down with it.
    cur.execute('DELETE FROM "SeoMetadata" WHERE "locationId" = %s', (phantom_id,))
    cur.execute('DELETE FROM "Location" WHERE id = %s', (phantom_id,))
    return biz, ev, spot


def find_displaced_businesses(cur) -> list[dict]:
    """Businesses far from their filed state (their CITY itself may be fine)."""
    rows = _rows(
        cur,
        """
        SELECT b.id, b.name, b.latitude, b.longitude, b.address,
               city.id, city.name, st.code
        FROM "Business" b
        JOIN "Location" city ON b."locationId" = city.id
        JOIN "Location" co ON city."parentId" = co.id AND co.type = 'COUNTY'
        JOIN "Location" st ON co."parentId" = st.id AND st.type = 'STATE'
        WHERE b.latitude IS NOT NULL
        """,
    )
    out = []
    for bid, bname, lat, lng, addr, cid, cname, state in rows:
        lat, lng = float(lat), float(lng)
        km = state_distance_km(state, lat, lng)
        if km is None or km <= VETO_KM:
            continue
        out.append(
            {
                "id": bid, "name": bname, "lat": lat, "lng": lng, "address": addr,
                "filed_city": cname, "filed_state": state, "city_id": cid,
                "distance_km": round(km), "true_state": nearest_state(lat, lng),
            }
        )
    return out


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="execute moves/merges (default: dry run)")
    args = ap.parse_args()

    with connect() as conn, conn.cursor() as cur:
        # ── Pass 1: phantom city rows ──
        displaced = find_displaced_cities(cur)
        write_csv(OUT / "displaced_cities.csv", displaced)
        print(f"Pass 1 — displaced city rows: {len(displaced)}")
        merged = skipped = 0
        for d in displaced:
            target = find_target_city(cur, d["name"], d["true_state"], d["lat"], d["lng"], d["id"])
            label = f'  {d["name"]} [{d["filed_state"]} -> {d["true_state"]}] {d["businesses"]} biz'
            if not target:
                print(f"{label}  !! no target city in {d['true_state']} — left in place, see CSV")
                skipped += 1
                continue
            if args.apply:
                biz, ev, spot = merge_city(cur, d["id"], target[0])
                conn.commit()
                print(f"{label}  => merged into {target[1]} ({biz} biz, {ev} events, {spot} spotlights)")
            else:
                print(f"{label}  => would merge into {target[1]}")
            merged += 1

        # ── Pass 2: individually displaced businesses (after pass 1 moves) ──
        stragglers = find_displaced_businesses(cur)
        write_csv(OUT / "displaced_businesses.csv", stragglers)
        print(f"\nPass 2 — businesses filed under a far-away state: {len(stragglers)}")
        moved = unfixed = 0
        for s in stragglers:
            target = find_target_city(cur, "", s["true_state"], s["lat"], s["lng"], s["city_id"])
            if not target:
                unfixed += 1
                continue
            if args.apply:
                cur.execute(
                    'UPDATE "Business" SET "locationId" = %s WHERE id = %s',
                    (target[0], s["id"]),
                )
                conn.commit()
            moved += 1

        mode = "APPLIED" if args.apply else "DRY RUN (re-run with --apply)"
        print(
            f"\n{mode}: {merged} phantom cities merged ({skipped} skipped), "
            f"{moved} straggler businesses re-pointed ({unfixed} without a target)."
        )
        if args.apply:
            print("Remember to hit the site's /api/revalidate (or wait for ISR) so labels refresh.")


if __name__ == "__main__":
    main()
