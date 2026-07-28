#!/usr/bin/env python3
"""Reachability audit: how can we actually contact the barns in our DB?

Email enrichment showed only ~6 barns anywhere have a scrapeable website, so
email is a dead channel. This measures the channels we DO have — chiefly phone
(captured from Google Maps) — so we can size a phone/SMS/voice (e.g. GHL)
outreach before paying for it. Read-only counts; optional CSV export of the
reachable, unclaimed audience for import into an outreach tool.

Usage (crawler folder; DATABASE_URL set):
  python audience_stats.py                     # print the breakdown
  python audience_stats.py --export out.csv    # + write unclaimed-with-phone CSV
"""

from __future__ import annotations

import argparse
import csv
import sys

from dotenv import load_dotenv

from equine_crawler.db import connect

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "https://thestabledirectory.com"

# A barn is "unclaimed" when no BusinessOwner row references it.
UNCLAIMED = 'NOT EXISTS (SELECT 1 FROM "BusinessOwner" o WHERE o."businessId" = b.id)'
HAS_PHONE = "b.phone IS NOT NULL AND b.phone <> ''"
HAS_EMAIL = "b.email IS NOT NULL AND b.email <> ''"
HAS_WEBSITE = "b.website IS NOT NULL AND b.website <> ''"

# A category assignment counts only when publicly approved.
CAT_APPROVED = "bc.\"reviewStatus\" IN ('AUTO_APPROVED', 'APPROVED')"

# Map a category slug to a plain label for the CSV / segmentation.
CATEGORY_LABELS = {
    "horse-boarding": "barn",
    "equine-veterinarian": "vet",
    "farrier": "farrier",
    "feed-forage": "feed",
    "training-facilities": "training",
    "trainer-instructor": "training",
    "tack-shop": "tack",
}


def category_membership_sql(alias: str = "bc") -> str:
    return (
        f'EXISTS (SELECT 1 FROM "BusinessCategory" {alias} '
        f'JOIN "Category" c ON c.id = {alias}."categoryId" '
        f'WHERE {alias}."businessId" = b.id '
        f'AND {alias}."reviewStatus" IN (\'AUTO_APPROVED\', \'APPROVED\') '
        f'AND c.slug = ANY(%(slugs)s))'
    )


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--export", metavar="CSV", help="write unclaimed-with-phone businesses to this CSV path")
    ap.add_argument("--published-only", action="store_true",
                    help="restrict export to published (live) listings")
    ap.add_argument("--categories",
                    default="horse-boarding,equine-veterinarian,farrier,feed-forage",
                    help="comma-separated category slugs to include (default: barns, vets, farriers, feed)")
    args = ap.parse_args()
    target_slugs = [s.strip() for s in args.categories.split(",") if s.strip()]

    with connect() as conn, conn.cursor() as cur:
        def n(where: str) -> int:
            cur.execute(f'SELECT count(*) FROM "Business" b WHERE {where}')
            return cur.fetchone()[0]

        total = n("true")
        published = n('b."isPublished" = true')
        with_phone = n(HAS_PHONE)
        with_email = n(HAS_EMAIL)
        with_website = n(HAS_WEBSITE)
        unclaimed = n(UNCLAIMED)
        pub_phone = n(f'b."isPublished" = true AND {HAS_PHONE}')
        reachable = n(f"{HAS_PHONE} AND {UNCLAIMED}")
        reachable_pub = n(f'b."isPublished" = true AND {HAS_PHONE} AND {UNCLAIMED}')

        def pct(x: int) -> str:
            return f"{x / total * 100:.0f}%" if total else "0%"

        print("── Reachability audit ─────────────────────────────")
        print(f"  Total barns            {total:>8}")
        print(f"  Published (live)       {published:>8}  ({pct(published)})")
        print(f"  Unclaimed              {unclaimed:>8}  ({pct(unclaimed)})")
        print("  ── contact channels ──")
        print(f"  Have phone             {with_phone:>8}  ({pct(with_phone)})")
        print(f"  Have email             {with_email:>8}  ({pct(with_email)})")
        print(f"  Have website           {with_website:>8}  ({pct(with_website)})")
        print("  ── outreach audiences ──")
        print(f"  Published + phone      {pub_phone:>8}")
        print(f"  Unclaimed + phone (all)      {reachable:>8}   <- SMS/voice ceiling")
        print(f"  Unclaimed + phone (published){reachable_pub:>8}   <- safest to start")

        print("  ── unclaimed + phone, by requested category ──")
        for slug in target_slugs:
            cur.execute(
                f'SELECT count(DISTINCT b.id) FROM "Business" b '
                f'WHERE {HAS_PHONE} AND {UNCLAIMED} AND '
                f'EXISTS (SELECT 1 FROM "BusinessCategory" bc JOIN "Category" c ON c.id = bc."categoryId" '
                f'WHERE bc."businessId" = b.id AND {CAT_APPROVED} AND c.slug = %s)',
                (slug,),
            )
            label = CATEGORY_LABELS.get(slug, slug)
            print(f"  {label:<12}{cur.fetchone()[0]:>8}  ({slug})")

        if args.export:
            where = f"{HAS_PHONE} AND {UNCLAIMED} AND {category_membership_sql()}"
            if args.published_only:
                where = f'b."isPublished" = true AND {where}'
            cur.execute(
                f"""
                SELECT b.name, b.phone, l.name AS city, st.name AS state, b.address,
                       b.slug, b."isPublished",
                       (SELECT string_agg(DISTINCT c.slug, ',')
                          FROM "BusinessCategory" bc
                          JOIN "Category" c ON c.id = bc."categoryId"
                          WHERE bc."businessId" = b.id AND {CAT_APPROVED}
                            AND c.slug = ANY(%(slugs)s)) AS cat_slugs
                FROM "Business" b
                LEFT JOIN "Location" l  ON l.id  = b."locationId"
                LEFT JOIN "Location" co ON co.id = l."parentId"
                LEFT JOIN "Location" st ON st.id = co."parentId"
                WHERE {where}
                ORDER BY b."reviewCount" DESC NULLS LAST
                """,
                {"slugs": target_slugs},
            )
            rows = cur.fetchall()

            def labels(cat_slugs: str | None) -> str:
                if not cat_slugs:
                    return ""
                seen: list[str] = []
                for s in cat_slugs.split(","):
                    lab = CATEGORY_LABELS.get(s, s)
                    if lab not in seen:
                        seen.append(lab)
                return ",".join(seen)

            with open(args.export, "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(["name", "phone", "category", "city", "state", "address", "claim_url", "published"])
                for name, phone, city, state, address, slug, is_pub, cat_slugs in rows:
                    w.writerow([name, phone, labels(cat_slugs), city or "", state or "",
                                address or "", f"{BASE_URL}/business/{slug}/claim",
                                "yes" if is_pub else "no"])
            print(f"\nExported {len(rows)} unclaimed-with-phone businesses "
                  f"[{args.categories}] → {args.export}")


if __name__ == "__main__":
    main()
