#!/usr/bin/env python3
"""One-shot moderation CLI (runs in GitHub Actions, which can reach Neon).

Mirrors web/src/lib/db/moderation.ts so approvals here are identical to the
admin UI: approve -> promote the category to GRADE_3_CONFIRMED/APPROVED and
recompute the business's isPublished flag; reject -> hide that category.

Usage (via the "Moderate listings" workflow, or locally with DATABASE_URL set):
  python moderate.py --action list
  python moderate.py --action approve --query "Wellington International"
  python moderate.py --action reject  --query "Some RV Park"
"""

from __future__ import annotations

import argparse
import os
import urllib.request

from dotenv import load_dotenv

from equine_crawler.db import connect, gen_id

_PENDING_WHERE = (
    "bc.\"reviewStatus\" = 'PENDING_REVIEW' "
    "AND bc.grade IN ('GRADE_1_NOT','GRADE_2_UNSURE')"
)


_CSV_PATH = os.environ.get("MODERATION_CSV", "moderation_queue.csv")


def _list(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT b.name, b.slug, c.name, bc.grade, b."isPublished",
                   b.address, b.website, b.attributes->>'googleMapsUri'
            FROM "BusinessCategory" bc
            JOIN "Business" b ON b.id = bc."businessId"
            JOIN "Category" c ON c.id = bc."categoryId"
            WHERE {_PENDING_WHERE}
            ORDER BY b.address ASC, b.name ASC
            """
        )
        rows = cur.fetchall()

    print(f"Moderation queue: {len(rows)} item(s) awaiting review\n")
    for name, slug, cat, grade, pub, *_ in rows:
        flag = "published" if pub else "hidden"
        print(f"  [{grade:<16}] {name}  ->  {cat}   ({slug}, {flag})")

    # Write a downloadable CSV (uploaded as a workflow artifact for review).
    import csv as _csv

    with open(_CSV_PATH, "w", newline="") as fh:
        w = _csv.writer(fh)
        w.writerow(["name", "category", "grade", "published", "address", "website", "google_maps", "slug"])
        for name, slug, cat, grade, pub, address, website, maps in rows:
            w.writerow([name, cat, grade, "yes" if pub else "no", address or "", website or "", maps or "", slug])
    print(f"\nWrote {len(rows)} rows to {_CSV_PATH}")


def _recompute_published(cur, business_id: str) -> None:
    cur.execute(
        'SELECT count(*) FROM "BusinessCategory" '
        "WHERE \"businessId\" = %s AND \"reviewStatus\" IN ('AUTO_APPROVED','APPROVED')",
        (business_id,),
    )
    publishable = cur.fetchone()[0]
    cur.execute(
        'UPDATE "Business" SET "isPublished" = %s, "updatedAt" = now() WHERE id = %s',
        (publishable > 0, business_id),
    )


def _moderate(conn, query: str, approve: bool) -> int:
    action = "approve" if approve else "reject"
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT bc."businessId", bc."categoryId", b.name, c.name
            FROM "BusinessCategory" bc
            JOIN "Business" b ON b.id = bc."businessId"
            JOIN "Category" c ON c.id = bc."categoryId"
            WHERE {_PENDING_WHERE} AND b.name ILIKE %s
            """,
            (f"%{query}%",),
        )
        targets = cur.fetchall()
        if not targets:
            print(f"No PENDING_REVIEW items match name ILIKE %{query}%")
            return 0

        affected: set[str] = set()
        for business_id, category_id, bname, cname in targets:
            if approve:
                cur.execute(
                    """
                    UPDATE "BusinessCategory"
                    SET grade='GRADE_3_CONFIRMED', "gradeSource"='STAFF_VERIFIED',
                        "reviewStatus"='APPROVED', "reviewedBy"=%s, "reviewedAt"=now(),
                        "updatedAt"=now()
                    WHERE "businessId"=%s AND "categoryId"=%s
                    """,
                    ("github-actions", business_id, category_id),
                )
            else:
                cur.execute(
                    """
                    UPDATE "BusinessCategory"
                    SET "reviewStatus"='REJECTED', "gradeSource"='STAFF_VERIFIED',
                        "reviewedBy"=%s, "reviewedAt"=now(), "updatedAt"=now()
                    WHERE "businessId"=%s AND "categoryId"=%s
                    """,
                    ("github-actions", business_id, category_id),
                )
            cur.execute(
                'INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "performedBy", "createdAt") '
                "VALUES (%s, %s, 'BusinessCategory', %s, 'github-actions', now())",
                (
                    gen_id(),
                    "CATEGORY_APPROVED" if approve else "CATEGORY_REJECTED",
                    f"{business_id}:{category_id}",
                ),
            )
            affected.add(business_id)
            print(f"  {action}d: {bname}  ->  {cname}")

        for business_id in affected:
            _recompute_published(cur, business_id)
    return len(targets)


def _revalidate() -> None:
    url = os.environ.get("REVALIDATE_URL")
    secret = os.environ.get("REVALIDATE_SECRET")
    if not (url and secret):
        return
    try:
        req = urllib.request.Request(
            url,
            data=b'{"tag":"businesses"}',
            headers={"Content-Type": "application/json", "x-revalidate-secret": secret},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10).read()
        print("  revalidate: pinged web app")
    except Exception as exc:  # noqa: BLE001
        print(f"  revalidate: failed ({exc})")


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Equine Directory moderation CLI")
    parser.add_argument("--action", choices=["list", "approve", "reject"], default="list")
    parser.add_argument("--query", default="", help="business-name substring (approve/reject)")
    args = parser.parse_args()

    with connect() as conn:
        if args.action == "list":
            _list(conn)
            return
        if not args.query.strip():
            raise SystemExit("--query is required for approve/reject")
        n = _moderate(conn, args.query.strip(), approve=(args.action == "approve"))
        if n:
            print(f"\n{args.action}d {n} category assignment(s).")
    if args.action == "approve":
        _revalidate()


if __name__ == "__main__":
    main()
