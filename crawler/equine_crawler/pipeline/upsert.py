"""Upsert normalized listings into Postgres with grade routing.

Grade 3 -> AUTO_APPROVED (published); grades 1 & 2 -> PENDING_REVIEW (queue).
A business is published iff it has >=1 publishable (grade-3/approved) category.
"""

from __future__ import annotations

import psycopg
from psycopg.types.json import Jsonb

from ..db import gen_id
from ..schemas import NormalizedListing


def load_category_ids(conn: psycopg.Connection) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute('SELECT slug, id FROM "Category"')
        return {slug: cid for slug, cid in cur.fetchall()}


def _upsert_business(conn: psycopg.Connection, n: NormalizedListing, existing_id: str | None) -> str:
    with conn.cursor() as cur:
        if existing_id:
            cur.execute(
                """
                UPDATE "Business" SET
                  name=%s, description=COALESCE(%s, description),
                  phone=COALESCE(%s, phone), website=COALESCE(%s, website),
                  address=%s, latitude=%s, longitude=%s, "locationId"=%s,
                  attributes=%s, "isPublished"="isPublished" OR %s,
                  "dataSourceUrl"=COALESCE(%s, "dataSourceUrl"),
                  "lastCrawledAt"=now(), "updatedAt"=now()
                WHERE id=%s
                """,
                (
                    n.name, n.description, n.phone, n.website, n.address,
                    n.latitude, n.longitude, n.location_id, Jsonb(n.attributes),
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
               "verificationBadge", "isVerified", "isPublished",
               "dataSourceUrl", "externalSourceId", "lastCrawledAt", "updatedAt")
            VALUES
              (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
               'UNVERIFIED'::"VerificationBadge", false, %s,
               %s, %s, now(), now())
            ON CONFLICT (slug) DO UPDATE SET
               "lastCrawledAt"=now(), "updatedAt"=now()
            RETURNING id
            """,
            (
                new_id, n.name, n.slug, n.description, n.phone, n.website, n.address,
                n.latitude, n.longitude, n.location_id, Jsonb(n.attributes),
                n.is_published, n.source_url, n.external_id,
            ),
        )
        return cur.fetchone()[0]


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
    _recompute_published(conn, business_id)
    _audit(conn, business_id, "BUSINESS_CREATED" if action == "created" else "BUSINESS_UPDATED")
    return business_id, action
