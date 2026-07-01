"""Resolve a listing's city to a Location, creating it under its county if needed.

For Broward we pre-seeded cities, but a statewide (and eventually national) run
hits thousands of cities we never seeded. Since every FL county IS seeded, we
look up the listing's county (from Places addressComponents) and create the city
under it on the fly, using the place's exact coordinates as the city centroid.
This makes the crawler self-expanding geographically.
"""

from __future__ import annotations

import re

import psycopg

from ..db import gen_id

_SLUG = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    return _SLUG.sub("-", name.lower()).strip("-")


def _resolve_global(cur: psycopg.Cursor, city: str) -> tuple[str, float, float] | None:
    """Seeded-city lookup with no county context (exact, then conservative fuzzy)."""
    cur.execute(
        """
        SELECT l.id, l.latitude, l.longitude
        FROM "Location" l
        WHERE l.type = 'CITY' AND lower(l.name) = lower(%s) AND l.latitude IS NOT NULL
        LIMIT 1
        """,
        (city,),
    )
    row = cur.fetchone()
    if row:
        return (row[0], float(row[1]), float(row[2]))
    cur.execute(
        """
        SELECT l.id, l.latitude, l.longitude, similarity(l.name, %s) AS s
        FROM "Location" l
        WHERE l.type = 'CITY' AND l.latitude IS NOT NULL AND l.name %% %s
        ORDER BY s DESC LIMIT 1
        """,
        (city, city),
    )
    row = cur.fetchone()
    if row and row[3] and row[3] >= 0.5:
        return (row[0], float(row[1]), float(row[2]))
    return None


def _find_county_id(cur: psycopg.Cursor, county: str | None, state: str | None = None) -> str | None:
    if not county:
        return None
    base = re.sub(r"\s+county$", "", county.strip(), flags=re.I)
    # County names collide across states (Jefferson County exists in ~25 states),
    # so when we know the state, anchor the match to that state's children.
    if state:
        cur.execute(
            """
            SELECT c.id FROM "Location" c
            JOIN "Location" s ON c."parentId" = s.id
            WHERE c.type = 'COUNTY' AND s.type = 'STATE' AND upper(s.code) = upper(%s)
              AND (lower(c.name) = lower(%s) OR lower(c.name) = lower(%s))
            LIMIT 1
            """,
            (state, county, base + " County"),
        )
        row = cur.fetchone()
        if row:
            return row[0]
        return None
    cur.execute(
        """
        SELECT id FROM "Location"
        WHERE type = 'COUNTY' AND (lower(name) = lower(%s) OR lower(name) = lower(%s))
        LIMIT 1
        """,
        (county, base + " County"),
    )
    row = cur.fetchone()
    return row[0] if row else None


def _resolve_nearest_city(
    cur: psycopg.Cursor,
    county_id: str | None,
    state: str | None,
    lat: float | None,
    lng: float | None,
) -> tuple[str, float, float] | None:
    """Snap a city-less listing to the nearest existing CITY by the place's
    coordinates — scoped to its county, then its state. Lets us keep a real barn
    that the source returned with no parseable city (we still have county/state
    from the query tag + exact lat/lng). Returns the place's own coords so the map
    dot stays exact; the matched city is just for grouping/URL."""
    if lat is None or lng is None:
        return None
    if county_id:
        cur.execute(
            """
            SELECT id FROM "Location"
            WHERE type = 'CITY' AND "parentId" = %s AND latitude IS NOT NULL
            ORDER BY (latitude - %s) * (latitude - %s) + (longitude - %s) * (longitude - %s) ASC
            LIMIT 1
            """,
            (county_id, lat, lat, lng, lng),
        )
        row = cur.fetchone()
        if row:
            return (row[0], lat, lng)
    if state:
        cur.execute(
            """
            SELECT l.id FROM "Location" l
            JOIN "Location" c ON l."parentId" = c.id
            JOIN "Location" s ON c."parentId" = s.id
            WHERE l.type = 'CITY' AND s.type = 'STATE' AND upper(s.code) = upper(%s)
              AND l.latitude IS NOT NULL
            ORDER BY (l.latitude - %s) * (l.latitude - %s) + (l.longitude - %s) * (l.longitude - %s) ASC
            LIMIT 1
            """,
            (state, lat, lat, lng, lng),
        )
        row = cur.fetchone()
        if row:
            return (row[0], lat, lng)
    return None


def resolve_or_create(
    conn: psycopg.Connection,
    city: str | None,
    county: str | None,
    lat: float | None,
    lng: float | None,
    state: str | None = None,
) -> tuple[str, float, float] | None:
    """Return (location_id, lat, lng). Creates the city under its county if it
    isn't seeded yet (statewide/national). The state code scopes the county
    match so same-named counties in other states don't cross-link. Falls back to
    a global seeded-city match when the county/state is unknown, and to the
    nearest existing city (by coords) when there's no parseable city at all."""
    with conn.cursor() as cur:
        county_id = _find_county_id(cur, county, state)
        if not city or not city.strip():
            # No parseable city — snap to the nearest existing city by coords
            # instead of dropping a real barn (see _resolve_nearest_city).
            return _resolve_nearest_city(cur, county_id, state, lat, lng)
        city = city.strip()
        if county_id:
            # Exact city within this county (avoids cross-county fuzzy errors).
            cur.execute(
                """
                SELECT id, latitude, longitude FROM "Location"
                WHERE type = 'CITY' AND "parentId" = %s AND lower(name) = lower(%s)
                LIMIT 1
                """,
                (county_id, city),
            )
            row = cur.fetchone()
            if row and row[1] is not None:
                return (row[0], float(row[1]), float(row[2]))

            # Create it (use the place's coords; fall back to county centroid).
            if lat is None or lng is None:
                cur.execute('SELECT latitude, longitude FROM "Location" WHERE id = %s', (county_id,))
                cc = cur.fetchone()
                if cc and cc[0] is not None:
                    lat, lng = float(cc[0]), float(cc[1])
            if lat is None or lng is None:
                return None

            if row:  # existed but had null coords — backfill
                cur.execute('UPDATE "Location" SET latitude=%s, longitude=%s WHERE id=%s', (lat, lng, row[0]))
                return (row[0], lat, lng)

            new_id = gen_id()
            slug = _slugify(city)
            cur.execute(
                """
                INSERT INTO "Location" (id, type, name, slug, "parentId", latitude, longitude, "updatedAt")
                VALUES (%s, 'CITY'::"LocationType", %s, %s, %s, %s, %s, now())
                ON CONFLICT (slug, type, "parentId") DO NOTHING
                RETURNING id
                """,
                (new_id, city, slug, county_id, lat, lng),
            )
            ins = cur.fetchone()
            if ins:
                return (ins[0], lat, lng)
            # Conflict (same slug under county): fetch the existing one.
            cur.execute(
                'SELECT id FROM "Location" WHERE slug=%s AND type=\'CITY\' AND "parentId"=%s LIMIT 1',
                (slug, county_id),
            )
            ex = cur.fetchone()
            if ex:
                return (ex[0], lat, lng)

        # No usable county — this is a never-crawled county (common once we're
        # scraping beyond the states with prior seed data). A pure nationwide
        # fuzzy text match on `city` alone (no state/coords scoping) is
        # unreliable for anything but already-seeded major metros, and was
        # silently dropping 40-65% of results in several states (measured on
        # CO/IL/IN/MI/MO/OH/OK during the national gosom rollout) — every
        # unmatched small town became a skip, even with a perfectly good lat/lng
        # on hand. Prefer the coordinate-based nearest-city fallback (uses the
        # place's own coords, scoped to state — geographically exact regardless
        # of name) and only fall back to the fuzzy text match if we have no
        # usable coordinates at all.
        nearest = _resolve_nearest_city(cur, county_id, state, lat, lng)
        if nearest:
            return nearest
        return _resolve_global(cur, city)


# Back-compat: original seeded-only resolver (still used by tests/fixtures).
def resolve_location(conn: psycopg.Connection, city: str | None) -> tuple[str, float, float] | None:
    if not city:
        return None
    with conn.cursor() as cur:
        return _resolve_global(cur, city.strip())
