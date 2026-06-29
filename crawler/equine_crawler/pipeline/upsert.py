"""Upsert normalized listings into Postgres with grade routing.

Grade 3 -> AUTO_APPROVED (published); grades 1 & 2 -> PENDING_REVIEW (queue).
A business is published iff it has >=1 publishable (grade-3/approved) category.
"""

from __future__ import annotations

import urllib.parse

import psycopg
from psycopg.types.json import Jsonb

from ..db import gen_id
from ..schemas import NormalizedListing


def load_category_ids(conn: psycopg.Connection) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute('SELECT slug, id FROM "Category"')
        return {slug: cid for slug, cid in cur.fetchall()}


def _upsert_business(conn: psycopg.Connection, n: NormalizedListing, existing_id: str | None) -> str:
    hours = Jsonb(n.hours) if n.hours else None
    with conn.cursor() as cur:
        if existing_id:
            cur.execute(
                """
                UPDATE "Business" SET
                  name=%s, description=COALESCE(%s, description),
                  phone=COALESCE(%s, phone), website=COALESCE(%s, website),
                  address=%s, latitude=%s, longitude=%s, "locationId"=%s,
                  attributes=COALESCE(attributes, '{}'::jsonb) || %s,
                  rating=COALESCE(%s, rating),
                  "reviewCount"=COALESCE(%s, "reviewCount"),
                  "hoursOfOperation"=COALESCE(%s, "hoursOfOperation"),
                  "isPublished"="isPublished" OR %s,
                  "dataSourceUrl"=COALESCE(%s, "dataSourceUrl"),
                  "lastCrawledAt"=now(), "updatedAt"=now()
                WHERE id=%s
                """,
                (
                    n.name, n.description, n.phone, n.website, n.address,
                    n.latitude, n.longitude, n.location_id, Jsonb(n.attributes),
                    n.rating, n.rating_count, hours,
                    n.is_published, n.source_url, existing_id,
                ),
            )
            return existing_id

        new_id = gen_id()
        cur.execute(
            """
            INSERT INTO "Business"
              (id, name, slug, description, phone, website, address,
               latitude, longitude, "locationId", attributes,
               rating, "reviewCount", "hoursOfOperation",
               "verificationBadge", "isVerified", "isPublished",
               "dataSourceUrl", "externalSourceId", "lastCrawledAt", "updatedAt")
            VALUES
              (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
               %s, %s, %s,
               'UNVERIFIED'::"VerificationBadge", false, %s,
               %s, %s, now(), now())
            ON CONFLICT (slug) DO UPDATE SET
               "lastCrawledAt"=now(), "updatedAt"=now()
            RETURNING id
            """,
            (
                new_id, n.name, n.slug, n.description, n.phone, n.website, n.address,
                n.latitude, n.longitude, n.location_id, Jsonb(n.attributes),
                n.rating, (n.rating_count or 0), hours,
                n.is_published, n.source_url, n.external_id,
            ),
        )
        return cur.fetchone()[0]


def _upsert_images(conn: psycopg.Connection, business_id: str, n: NormalizedListing) -> None:
    """Refresh Google Places photos for a business. Never touches owner uploads.

    Stores the place-photo proxy path (resolved server-side via /api/place-photo
    using the server Places key) plus author attribution in the caption.
    """
    if not n.photos:
        return
    with conn.cursor() as cur:
        cur.execute(
            'DELETE FROM "BusinessImage" WHERE "businessId"=%s AND source=%s::"ImageSource"',
            (business_id, "GOOGLE"),
        )
        for rank, ph in enumerate(n.photos):
            ref = ph.get("ref")
            if not ref:
                continue
            url = "/api/place-photo?ref=" + urllib.parse.quote(ref, safe="")
            caption = ph.get("attribution") or "Google"
            cur.execute(
                """
                INSERT INTO "BusinessImage"
                  (id, "businessId", url, "altText", caption, rank, source, "uploadedAt")
                VALUES (%s, %s, %s, %s, %s, %s, 'GOOGLE'::"ImageSource", now())
                """,
                (gen_id(), business_id, url, n.name, caption, rank),
            )


def _upsert_categories(
    conn: psycopg.Connection, business_id: str, n: NormalizedListing, cat_ids: dict[str, str]
) -> None:
    with conn.cursor() as cur:
        for rank, gc in enumerate(n.graded_categories):
            cat_id = cat_ids.get(gc.category_slug)
            if not cat_id:
                continue
            cur.execute(
                """
                INSERT INTO "BusinessCategory"
                  ("businessId", "categoryId", "isPrimary", rank, grade,
                   "gradeSource", confidence, "evidenceQuote", "reviewStatus", "updatedAt")
                VALUES
                  (%s, %s, %s, %s, %s::"CategoryGrade",
                   'LLM_EXTRACTION'::"GradeSource", %s, %s, %s::"ReviewStatus", now())
                ON CONFLICT ("businessId", "categoryId") DO UPDATE SET
                   grade=EXCLUDED.grade, confidence=EXCLUDED.confidence,
                   "evidenceQuote"=EXCLUDED."evidenceQuote",
                   -- never override a human decision (APPROVED/REJECTED)
                   "reviewStatus"=CASE
                     WHEN "BusinessCategory"."reviewStatus" IN ('APPROVED','REJECTED')
                     THEN "BusinessCategory"."reviewStatus" ELSE EXCLUDED."reviewStatus" END,
                   "updatedAt"=now()
                """,
                (
                    business_id, cat_id, gc.is_primary, rank, gc.grade.db_grade,
                    gc.confidence, gc.evidence_quote, gc.grade.review_status,
                ),
            )


# Facet key -> DB column. Only these crawler-inferable columns are pre-filled;
# every other facet (amenities, pricing, etc.) is owner-only.
_FACET_COLUMNS: dict[str, str] = {
    "disciplines": "disciplines",
    "boardTypes": "boardTypes",
    "trainingTypes": "trainingTypes",
}


def _prefill_facets(conn: psycopg.Connection, business_id: str, n: NormalizedListing) -> None:
    """Seed low-confidence facet columns from inferred Google data.

    Writes a facet column ONLY when (a) it is currently empty for this business
    AND (b) the facet key is not present in "ownerEditedFacets". Never clears a
    column, never overwrites a non-empty one, and never touches
    "ownerEditedFacets" — so it is safe and idempotent on re-crawl.
    """
    if not n.inferred_facets:
        return
    with conn.cursor() as cur:
        for key, slugs in n.inferred_facets.items():
            col = _FACET_COLUMNS.get(key)
            if not col or not slugs:
                continue
            # SQL guards make this atomic w.r.t. owner edits: the row is updated
            # only while the column is still empty and the key is unclaimed.
            cur.execute(
                f"""
                UPDATE "Business" SET "{col}"=%s, "updatedAt"=now()
                WHERE id=%s
                  AND ("{col}" IS NULL OR cardinality("{col}")=0)
                  AND NOT (%s = ANY("ownerEditedFacets"))
                """,
                (list(slugs), business_id, key),
            )


def _recompute_published(conn: psycopg.Connection, business_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "Business" SET "isPublished" = EXISTS (
              SELECT 1 FROM "BusinessCategory"
              WHERE "businessId"=%s AND "reviewStatus" IN ('AUTO_APPROVED','APPROVED')
            ) WHERE id=%s
            """,
            (business_id, business_id),
        )


def _audit(conn: psycopg.Connection, business_id: str, action: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "performedBy") '
            "VALUES (%s, %s, 'Business', %s, 'crawler')",
            (gen_id(), action, business_id),
        )


def upsert_listing(
    conn: psycopg.Connection, n: NormalizedListing, cat_ids: dict[str, str], existing_id: str | None
) -> tuple[str, str]:
    """Returns (business_id, 'created'|'updated')."""
    action = "updated" if existing_id else "created"
    business_id = _upsert_business(conn, n, existing_id)
    _upsert_categories(conn, business_id, n, cat_ids)
    _upsert_images(conn, business_id, n)
    _prefill_facets(conn, business_id, n)
    _recompute_published(conn, business_id)
    _audit(conn, business_id, "BUSINESS_CREATED" if action == "created" else "BUSINESS_UPDATED")
    return business_id, action
