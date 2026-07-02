#!/usr/bin/env python3
"""Seed STATE + COUNTY Location rows for all 47 crawlable states.

Phase-1 audit root cause: the geocoder can only file a listing under a county
that exists in Location. Only the early states (FL/TX/CA/NC/GA/KY) ever had
county rows, so every other state's rows fell back to a nationwide city-NAME
match and got mis-filed into whichever earlier state had a same-named city —
6,252 published listings filed under the wrong state. Seeding all counties
(names already in equine_crawler.registry.STATE_COUNTY_AREAS) lets
resolve_or_create() file every state correctly; re-ingesting each state's saved
gosom JSON then re-files the mis-filed rows via the upsert UPDATE.

Idempotent (ON CONFLICT DO NOTHING). Run from the crawler folder:
    python seed_counties.py
Then re-ingest each state:  python run.py --source gmaps-file --file out/results-<ST>.json --no-llm
"""

from __future__ import annotations

import re
import sys

from dotenv import load_dotenv

from equine_crawler.db import connect, gen_id
from equine_crawler.registry import STATE_COUNTY_AREAS

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

STATE_NAMES = {
    "AL": "Alabama", "AR": "Arkansas", "AZ": "Arizona", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida",
    "GA": "Georgia", "IA": "Iowa", "ID": "Idaho", "IL": "Illinois",
    "IN": "Indiana", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana",
    "MA": "Massachusetts", "MD": "Maryland", "ME": "Maine", "MI": "Michigan",
    "MN": "Minnesota", "MO": "Missouri", "MS": "Mississippi", "MT": "Montana",
    "NC": "North Carolina", "ND": "North Dakota", "NE": "Nebraska",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
    "NV": "Nevada", "NY": "New York", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island",
    "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee",
    "TX": "Texas", "UT": "Utah", "VA": "Virginia", "VT": "Vermont",
    "WA": "Washington", "WI": "Wisconsin", "WV": "West Virginia",
    "WY": "Wyoming",
}

_SLUG = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    return _SLUG.sub("-", name.lower()).strip("-")


def main() -> None:
    load_dotenv()
    created_states = created_counties = 0
    with connect() as conn, conn.cursor() as cur:
        for code, areas in sorted(STATE_COUNTY_AREAS.items()):
            name = STATE_NAMES.get(code)
            if not name:
                print(f"  skip unknown state code {code}")
                continue
            # Ensure the STATE row (match by code first — some already exist).
            cur.execute(
                "SELECT id FROM \"Location\" WHERE type = 'STATE' AND upper(code) = %s LIMIT 1",
                (code,),
            )
            row = cur.fetchone()
            if row:
                state_id = row[0]
            else:
                state_id = gen_id()
                cur.execute(
                    """
                    INSERT INTO "Location" (id, type, name, slug, code, "updatedAt")
                    VALUES (%s, 'STATE'::"LocationType", %s, %s, %s, now())
                    ON CONFLICT (slug, type, "parentId") DO NOTHING
                    RETURNING id
                    """,
                    (state_id, name, slugify(name), code),
                )
                ins = cur.fetchone()
                if ins is None:  # slug conflict — fetch existing
                    cur.execute(
                        "SELECT id FROM \"Location\" WHERE type='STATE' AND slug=%s LIMIT 1",
                        (slugify(name),),
                    )
                    state_id = cur.fetchone()[0]
                else:
                    created_states += 1

            # Seed each county under the state. Registry areas look like
            # "Marion County FL" — strip the trailing state code for the name.
            n_new = 0
            for area in areas:
                county_name = re.sub(r"\s+[A-Z]{2}$", "", area.strip())
                cur.execute(
                    """
                    INSERT INTO "Location" (id, type, name, slug, "parentId", "updatedAt")
                    VALUES (%s, 'COUNTY'::"LocationType", %s, %s, %s, now())
                    ON CONFLICT (slug, type, "parentId") DO NOTHING
                    RETURNING id
                    """,
                    (gen_id(), county_name, slugify(county_name), state_id),
                )
                if cur.fetchone():
                    n_new += 1
            created_counties += n_new
            print(f"  {code}: +{n_new} counties")
        conn.commit()
    print(f"done: {created_states} states created, {created_counties} counties created (existing rows untouched)")


if __name__ == "__main__":
    main()
