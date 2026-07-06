#!/usr/bin/env python3
"""Generate a gosom (google-maps-scraper) queries.txt for the boarding crawl.

Each line is "<phrase> <County> <ST> #!#<County>|<ST>" — the part after #!# is a
gosom custom id that comes back on every result row (input_id), so the ingest
(run.py --source gmaps-file) can place each barn under the right county/state.

Usage:
  python gen_gmaps_queries.py                  # all 48 states, boarding phrases
  python gen_gmaps_queries.py --state TX CA    # only these states
  python gen_gmaps_queries.py --dense          # only dense counties (from dense_counties.csv)
  python gen_gmaps_queries.py --out queries.txt
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from equine_crawler.registry import ADJACENT_QUERY_SPECS, PLACES, _FL_AREAS, STATE_COUNTY_AREAS

_DENSE_CSV = Path(__file__).resolve().parent / "dense_counties.csv"


def _all_areas() -> list[str]:
    areas = list(_FL_AREAS)
    for v in STATE_COUNTY_AREAS.values():
        areas.extend(v)
    return areas


def _dense_areas() -> list[str]:
    if not _DENSE_CSV.exists():
        return []
    with open(_DENSE_CSV) as fh:
        return [r["area"] for r in csv.DictReader(fh)]


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate gosom queries.txt")
    ap.add_argument("--state", nargs="*", help="2-letter state codes to include (default: all)")
    ap.add_argument("--dense", action="store_true", help="only dense counties (dense_counties.csv)")
    ap.add_argument(
        "--adjacent",
        action="store_true",
        help="also search the other verticals (farrier/vet/tack/feed/trainer/…) — "
        "adds ADJACENT_QUERY_SPECS; ~4x more queries but fills out the multi-category directory",
    )
    ap.add_argument(
        "--only-adjacent",
        action="store_true",
        help="ONLY the adjacent verticals (skip boarding phrases) — for a targeted "
        "top-up run after boarding is already crawled",
    )
    ap.add_argument("--out", default=None, help="output file (default: stdout)")
    args = ap.parse_args()

    areas = _dense_areas() if args.dense else _all_areas()
    if args.state:
        codes = {s.upper() for s in args.state}
        areas = [a for a in areas if a.rsplit(" ", 1)[-1].upper() in codes]

    # Phrase set: boarding by default; --adjacent adds the other verticals'
    # dedicated searches (farrier/vet/tack/feed/trainer/…), --only-adjacent runs
    # just those (a top-up pass once boarding is already crawled).
    specs = list(PLACES.query_specs)
    if args.only_adjacent:
        specs = list(ADJACENT_QUERY_SPECS)
    elif args.adjacent:
        specs = specs + list(ADJACENT_QUERY_SPECS)
    phrases = list(dict.fromkeys(p for p, _ in specs))

    lines: list[str] = []
    for area in areas:
        county, _, st = area.rpartition(" ")
        for phrase in phrases:
            lines.append(f"{phrase} {area} #!#{county}|{st}")

    text = "\n".join(lines) + "\n"
    if args.out:
        Path(args.out).write_text(text)
        print(f"wrote {len(lines)} queries ({len(areas)} areas x {len(phrases)} phrases) to {args.out}")
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
