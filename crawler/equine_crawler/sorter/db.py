"""Staging read + idempotent publish for the sorter (brief Phase 3 steps 1,4,5).

The immutable raw store is the saved gosom JSON in crawler/out/ — never
overwritten. The Business rows are the staging view the sorter reads: each
carries a stable identifier ("externalSourceId", falling back to the row id)
that keys idempotency, plus the audit trail in "dataSourceUrl"/CrawlJob.

Apply is idempotent on that stable id and never overrides a human decision
(BusinessCategory.reviewStatus IN ('APPROVED','REJECTED')).
"""

from __future__ import annotations

from typing import Any

import psycopg

from ..db import gen_id
from .core import Decision

# Fields handed to the sorter (brief §3 Input format). category_raw is the
# business's current primary published category name.
_FETCH_SQL = """
SELECT
  COALESCE(b."externalSourceId", b.id)          AS source_id,
  b.id                                          AS business_id,
  b.name, b.address, b.phone,
  b.latitude, b.longitude, b.rating, b."reviewCount" AS review_count,
  b."dataSourceUrl"                             AS url,
  b.description,
  city.name  AS city,
  county.name AS county,
  s.code     AS state,
  (SELECT c.name FROM "BusinessCategory" bc
     JOIN "Category" c ON c.id = bc."categoryId"
    WHERE bc."businessId" = b.id
    ORDER BY bc."isPrimary" DESC, bc.rank ASC
    LIMIT 1)                                     AS category_raw,
  (SELECT c.slug FROM "BusinessCategory" bc
     JOIN "Category" c ON c.id = bc."categoryId"
    WHERE bc."businessId" = b.id
    ORDER BY bc."isPrimary" DESC, bc.rank ASC
    LIMIT 1)                                     AS primary_slug
FROM "Business" b
JOIN "Location" city   ON city.id = b."locationId"
LEFT JOIN "Location" county ON county.id = city."parentId"
LEFT JOIN "Location" s      ON s.id = county."parentId"
WHERE b."isPublished"
{state_filter}
ORDER BY b.id
{limit}
"""


def fetch_records(
    conn: psycopg.Connection, *, state: str | None = None, limit: int | None = None
) -> list[dict[str, Any]]:
    """Read published businesses as sorter input records. Keeps business_id and
    primary_slug alongside the sorter-facing fields for the apply step."""
    sql = _FETCH_SQL.format(
        state_filter="AND s.code = %(state)s" if state else "",
        limit="LIMIT %(limit)s" if limit else "",
    )
    params: dict[str, Any] = {}
    if state:
        params["state"] = state.upper()
    if limit:
        params["limit"] = limit
    with conn.cursor() as cur:
        cur.execute(sql, params)
        cols = [d.name for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    for r in rows:
        # Drop nulls so the model sees "missing field" rather than "null".
        for k in list(r):
            if r[k] is None:
                del r[k]
    return rows


def _categorize(cur: psycopg.Cursor, business_id: str, cat_id: str) -> None:
    """Set `cat_id` as the business's published primary category and demote the
    rest. Never touches a human APPROVED/REJECTED row's status."""
    cur.execute(
        """
        INSERT INTO "BusinessCategory"
          ("businessId","categoryId","isPrimary",rank,grade,"gradeSource",
           confidence,"reviewStatus","reviewedBy","reviewedAt","updatedAt")
        VALUES
          (%s,%s,true,0,'GRADE_3_CONFIRMED'::"CategoryGrade",'LLM_EXTRACTION'::"GradeSource",
           0.9,'AUTO_APPROVED'::"ReviewStatus",'sonnet-sorter',now(),now())
        ON CONFLICT ("businessId","categoryId") DO UPDATE SET
          "isPrimary"=true,
          "reviewStatus"=CASE
            WHEN "BusinessCategory"."reviewStatus" IN ('APPROVED','REJECTED')
            THEN "BusinessCategory"."reviewStatus" ELSE 'AUTO_APPROVED'::"ReviewStatus" END,
          "reviewedBy"='sonnet-sorter',"reviewedAt"=now(),"updatedAt"=now()
        """,
        (business_id, cat_id),
    )
    cur.execute(
        'UPDATE "BusinessCategory" SET "isPrimary"=false, "updatedAt"=now() '
        'WHERE "businessId"=%s AND "categoryId"<>%s AND "isPrimary"',
        (business_id, cat_id),
    )


def _review(cur: psycopg.Cursor, business_id: str, reason: str) -> None:
    """Route a flagged business to the human queue: unpublish its auto-approved
    categories (leaving human decisions intact) and file an idempotent Report
    that surfaces in /admin/reports."""
    cur.execute(
        """
        UPDATE "BusinessCategory"
           SET "reviewStatus"='PENDING_REVIEW'::"ReviewStatus", "updatedAt"=now()
         WHERE "businessId"=%s AND "reviewStatus"='AUTO_APPROVED'
        """,
        (business_id,),
    )
    # One open sorter report per business — don't pile up on re-runs.
    cur.execute(
        """
        INSERT INTO "Report" (id,"businessId",reason,detail,"reporterId",status,"createdAt")
        SELECT %s,%s,'not_a_stable',%s,'sonnet-sorter','open',now()
        WHERE NOT EXISTS (
          SELECT 1 FROM "Report"
           WHERE "businessId"=%s AND "reporterId"='sonnet-sorter' AND status='open')
        """,
        (gen_id(), business_id, reason[:512], business_id),
    )


def _recompute_published(cur: psycopg.Cursor, business_id: str) -> None:
    cur.execute(
        """
        UPDATE "Business" SET "isPublished" = EXISTS (
          SELECT 1 FROM "BusinessCategory"
           WHERE "businessId"=%s AND "reviewStatus" IN ('AUTO_APPROVED','APPROVED')
        ) WHERE id=%s
        """,
        (business_id, business_id),
    )


def apply_decisions(
    conn: psycopg.Connection,
    decisions: list[Decision],
    id_to_business: dict[str, str],
    current_slug: dict[str, str | None],
    cat_ids: dict[str, str],
) -> dict[str, int]:
    """Write reconciled decisions. Categorize records only when the target slug
    differs from the current primary (minimizes churn); review records unpublish
    + file a Report. Returns per-action counts. Idempotent on the stable id."""
    counts = {"categorized": 0, "reviewed": 0, "unchanged": 0, "skipped": 0}
    with conn.cursor() as cur:
        for d in decisions:
            business_id = id_to_business.get(d.source_id)
            if not business_id:
                counts["skipped"] += 1
                continue
            if d.action == "review":
                _review(cur, business_id, d.reason or "flagged by sorter")
                _recompute_published(cur, business_id)
                counts["reviewed"] += 1
            elif d.action == "categorize":
                if current_slug.get(d.source_id) == d.slug:
                    counts["unchanged"] += 1
                    continue
                cat_id = cat_ids.get(d.slug or "")
                if not cat_id:
                    counts["skipped"] += 1
                    continue
                _categorize(cur, business_id, cat_id)
                _recompute_published(cur, business_id)
                counts["categorized"] += 1
    return counts
