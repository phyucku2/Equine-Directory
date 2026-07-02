#!/usr/bin/env python3
"""Phase-1 data-quality audit (pipeline build brief §2).

Quantifies, across the FULL dataset (not samples), the defect classes found in
manual review of the live site:
  1. Category mislabeling — published "boarding" businesses whose NAME signals a
     non-equestrian business (UTV tours, skydiving, goat yoga, towing, ...).
  2. Location mismatch — the address text names a different state than the
     Location the listing is filed under (e.g. address "Lebanon, TN 37090"
     filed under Kentucky > Marion County > Lebanon).
  3. Scale/context — per-state published counts, review-queue size, open
     reports, and exact-duplicate name+city pairs.

Read-only: no writes. Prints a summary and drops offender CSVs into out/ for
human review. Run from the crawler folder with DATABASE_URL set:

    python audit.py
"""

from __future__ import annotations

import csv
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

from equine_crawler.db import connect

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Name tokens that indicate a business is not a boarding/riding facility even
# though it carries a published horse-boarding category. Mirrors (and extends)
# the web app's NON_BARN_NAME_KEYWORDS with the specific offenders from the
# manual site sample (UTV tours, skydiving, towing, sail charters).
NON_EQUINE_NAME_TOKENS = (
    "goat yoga", "petting zoo", "petting farm", "farm tour", "pumpkin patch",
    "corn maze", "wedding venue", "axe throwing", "go kart", "go-kart",
    "mini golf", "water park", "trampoline park", "goat farm", "dairy",
    "creamery", "alpaca", "llama", "u-pick", "u pick", "sunflower",
    "skydiv", "utv", "atv", "off-road", "offroad", "towing", "tow truck",
    "sailboat", "sail charter", "boat charter", "jet ski", "kayak",
    "paintball", "escape room", "brewery", "winery", "distillery",
    "bounce house", "laser tag",
)

# Two-letter state token in a US address tail, e.g. "..., Lebanon, TN 37090".
_ADDR_STATE = re.compile(r",\s*([A-Z]{2})[ ,]+\d{5}(?:-\d{4})?")

STATES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC",
}


def addr_state(address: str | None) -> str | None:
    if not address:
        return None
    m = _ADDR_STATE.search(address)
    if m and m.group(1) in STATES:
        return m.group(1)
    return None


def main() -> None:
    load_dotenv()
    out = Path("out")
    out.mkdir(exist_ok=True)

    with connect() as conn, conn.cursor() as cur:
        # ── Scale/context ────────────────────────────────────────────────
        cur.execute('SELECT count(*) FROM "Business"')
        total = cur.fetchone()[0]
        cur.execute('SELECT count(*) FROM "Business" WHERE "isPublished"')
        published = cur.fetchone()[0]
        cur.execute(
            """SELECT count(*) FROM "BusinessCategory"
               WHERE "reviewStatus" = 'PENDING_REVIEW'"""
        )
        review_queue = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM \"Report\" WHERE status = 'open'")
        open_reports = cur.fetchone()[0]

        print(f"dataset: {total} businesses, {published} published, "
              f"{review_queue} category claims pending review, {open_reports} open reports")

        # Per-state published counts (via Location hierarchy).
        cur.execute(
            """
            SELECT COALESCE(s.code, 'UNKNOWN') AS st, count(*) AS n
            FROM "Business" b
            JOIN "Location" city ON city.id = b."locationId"
            LEFT JOIN "Location" county ON county.id = city."parentId"
            LEFT JOIN "Location" s ON s.id = county."parentId"
            WHERE b."isPublished"
            GROUP BY 1 ORDER BY 2 DESC
            """
        )
        rows = cur.fetchall()
        print("\npublished by state:")
        for st, n in rows:
            print(f"  {st:8} {n}")

        # ── Defect 1: category mislabeling (published non-equine names) ──
        pats = ["%" + t + "%" for t in NON_EQUINE_NAME_TOKENS]
        cur.execute(
            """
            SELECT b.id, b.name, b.address
            FROM "Business" b
            WHERE b."isPublished" AND b.name ILIKE ANY(%s)
            ORDER BY b.name
            """,
            (pats,),
        )
        bad_cat = cur.fetchall()
        pct = 100.0 * len(bad_cat) / published if published else 0.0
        print(f"\ndefect 1 — published businesses with non-equine name signals: "
              f"{len(bad_cat)} ({pct:.2f}% of published)")
        with (out / "audit-category-offenders.csv").open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["id", "name", "address"])
            w.writerows(bad_cat)

        # ── Defect 2: location mismatch (address state vs filed state) ──
        cur.execute(
            """
            SELECT b.id, b.name, b.address, s.code AS filed_state
            FROM "Business" b
            JOIN "Location" city ON city.id = b."locationId"
            LEFT JOIN "Location" county ON county.id = city."parentId"
            LEFT JOIN "Location" s ON s.id = county."parentId"
            WHERE b."isPublished" AND b.address IS NOT NULL AND s.code IS NOT NULL
            """
        )
        mismatches = []
        checked = 0
        for bid, name, address, filed in cur.fetchall():
            a = addr_state(address)
            if a is None:
                continue
            checked += 1
            if a != filed:
                mismatches.append((bid, name, address, filed, a))
        pct = 100.0 * len(mismatches) / checked if checked else 0.0
        print(f"defect 2 — filed-state vs address-state mismatches: "
              f"{len(mismatches)} of {checked} checkable ({pct:.2f}%)")
        with (out / "audit-location-offenders.csv").open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["id", "name", "address", "filed_state", "address_state"])
            w.writerows(mismatches)

        # ── Duplicates (same normalized name + city) ─────────────────────
        cur.execute(
            """
            SELECT lower(b.name), b."locationId", count(*) AS n
            FROM "Business" b
            WHERE b."isPublished"
            GROUP BY 1, 2 HAVING count(*) > 1
            ORDER BY n DESC
            """
        )
        dupes = cur.fetchall()
        extra = sum(n - 1 for _, _, n in dupes)
        print(f"duplicates — name+city groups with >1 published row: {len(dupes)} "
              f"({extra} excess rows)")

    print("\noffender CSVs written to out/audit-category-offenders.csv and "
          "out/audit-location-offenders.csv — paste this summary to Claude.")


if __name__ == "__main__":
    main()
