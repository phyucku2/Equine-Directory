"""Resolve a listing's city name to a seeded Location (id + coordinates).

MVP uses the seeded city centroid as the listing's lat/lng. Per-address
geocoding (Mapbox/Google) is a later enhancement; the schema already stores
precise lat/lng so we can refine in place.
"""

from __future__ import annotations

import psycopg


def resolve_location(conn: psycopg.Connection, city: str | None) -> tuple[str, float, float] | None:
    """Return (location_id, lat, lng) for a FL city name, or None if unknown."""
    if not city:
        return None
    city = city.strip()
    with conn.cursor() as cur:
        # Exact (case-insensitive) city match within Florida.
        cur.execute(
            """
            SELECT l.id, l.latitude, l.longitude
            FROM "Location" l
            WHERE l.type = 'CITY' AND lower(l.name) = lower(%s)
              AND l.latitude IS NOT NULL
            LIMIT 1
            """,
            (city,),
        )
        row = cur.fetchone()
        if row:
            return (row[0], float(row[1]), float(row[2]))

        # Fuzzy fallback via trigram similarity.
        cur.execute(
            """
            SELECT l.id, l.latitude, l.longitude, similarity(l.name, %s) AS s
            FROM "Location" l
            WHERE l.type = 'CITY' AND l.latitude IS NOT NULL AND l.name %% %s
            ORDER BY s DESC
            LIMIT 1
            """,
            (city, city),
        )
        row = cur.fetchone()
        if row and row[3] and row[3] >= 0.4:
            return (row[0], float(row[1]), float(row[2]))
    return None
