"""Duplicate detection against existing businesses (pg_trgm + exact keys)."""

from __future__ import annotations

import psycopg


def find_existing(
    conn: psycopg.Connection,
    slug: str,
    name: str,
    phone: str | None,
    website: str | None,
) -> str | None:
    """Return an existing Business id if this looks like the same business."""
    with conn.cursor() as cur:
        # 1) Stable slug match (our idempotency key).
        cur.execute('SELECT id FROM "Business" WHERE slug = %s LIMIT 1', (slug,))
        row = cur.fetchone()
        if row:
            return row[0]

        # 2) Same phone or website is a strong duplicate signal.
        if phone:
            cur.execute('SELECT id FROM "Business" WHERE phone = %s LIMIT 1', (phone,))
            row = cur.fetchone()
            if row:
                return row[0]
        if website:
            cur.execute('SELECT id FROM "Business" WHERE website = %s LIMIT 1', (website,))
            row = cur.fetchone()
            if row:
                return row[0]

        # 3) Very similar name (trigram) — conservative threshold.
        cur.execute(
            'SELECT id, similarity(name, %s) s FROM "Business" '
            "WHERE name %% %s ORDER BY s DESC LIMIT 1",
            (name, name),
        )
        row = cur.fetchone()
        if row and row[1] and row[1] >= 0.75:
            return row[0]
    return None
