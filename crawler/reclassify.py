#!/usr/bin/env python3
"""Re-file mis-categorized crawl listings into their true category.

The gmaps crawl searches horse phrases, so every result enters the DB with the
*search* category as its claim (usually horse-boarding). Real-but-different
equine businesses (feed stores, vets, tack shops, farriers, trail-ride outfits)
therefore sit in the PENDING_REVIEW queue with a claim the moderation grader
correctly refuses to approve — they aren't boarding — but shouldn't reject
either. This tool re-files them:

  For each business it determines the TRUE category from (a) the gosom-scraped
  Google business type (via --types-file, built from the crawl artifacts and
  joined on Business."externalSourceId"), falling back to (b) name keywords.
  Mapped businesses get the target category APPROVED (grade 3) and the wrong
  pending claim REJECTED; isPublished is recomputed. Unmappable businesses stay
  in the queue untouched.

  Published tour-type businesses additionally GAIN the trail-rides category
  (dual-listed; nothing is ever demoted — owner decision 2026-07-15).

Read-only by default: writes out/reclassify-decisions.csv for review.
--apply commits.

Usage (crawler folder; DATABASE_URL set):
  python reclassify.py --types-file out/types.jsonl            # dry run
  python reclassify.py --types-file out/types.jsonl --apply
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

from equine_crawler.db import connect
from equine_crawler.vertical_map import DIRECT_TYPE_MAP, TRAIL, load_types, target_for
from moderate import _recompute_published

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OUT = Path("out")

def approve_category(cur, business_id: str, category_id: str, make_primary: bool) -> None:
    cur.execute(
        """
        INSERT INTO "BusinessCategory"
          ("businessId", "categoryId", "isPrimary", rank, grade,
           "gradeSource", "reviewStatus", "reviewedBy", "reviewedAt", "updatedAt")
        VALUES (%s, %s, %s, 99, 'GRADE_3_CONFIRMED'::"CategoryGrade",
                'CRAWL_INFERRED'::"GradeSource", 'APPROVED'::"ReviewStatus",
                'system:reclassify', now(), now())
        ON CONFLICT ("businessId", "categoryId") DO UPDATE SET
          grade='GRADE_3_CONFIRMED'::"CategoryGrade",
          "reviewStatus"='APPROVED'::"ReviewStatus",
          "reviewedBy"='system:reclassify', "reviewedAt"=now(), "updatedAt"=now()
        """,
        (business_id, category_id, make_primary),
    )


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--types-file", type=Path, help="JSONL of {external_id, type} from crawl artifacts")
    ap.add_argument("--apply", action="store_true", help="commit decisions (default: dry run)")
    ap.add_argument("--limit", type=int, help="cap number of businesses")
    args = ap.parse_args()

    types = load_types(args.types_file) if args.types_file and args.types_file.exists() else {}
    print(f"Loaded {len(types)} scraped types")

    OUT.mkdir(parents=True, exist_ok=True)
    rows_out: list[dict] = []
    refiled = trail_added = left = 0

    with connect() as conn, conn.cursor() as cur:
        cur.execute('SELECT id, slug FROM "Category"')
        cat_ids = {slug: cid for cid, slug in cur.fetchall()}
        missing = {s for _, s in DIRECT_TYPE_MAP} | {TRAIL, "equine-veterinarian"} - set(cat_ids)
        missing -= set(cat_ids)
        if missing:
            raise SystemExit(f"categories missing from DB: {missing}")

        # 1) The pending queue: businesses whose only claims await review.
        cur.execute(
            """
            SELECT b.id, b.name, b.description, b."externalSourceId",
                   array_agg(bc."categoryId") AS pending_cat_ids
            FROM "BusinessCategory" bc
            JOIN "Business" b ON b.id = bc."businessId"
            WHERE bc."reviewStatus" = 'PENDING_REVIEW'
              AND bc.grade IN ('GRADE_1_NOT','GRADE_2_UNSURE')
            GROUP BY b.id, b.name, b.description, b."externalSourceId"
            ORDER BY b.name
            """
            + (" LIMIT %s" if args.limit else ""),
            (args.limit,) if args.limit else (),
        )
        queue = cur.fetchall()
        print(f"Pending businesses: {len(queue)}{' — DRY RUN' if not args.apply else ''}")

        for i, (bid, name, desc, ext, pending_ids) in enumerate(queue, 1):
            gtype = types.get(ext or "")
            slug, reason = target_for(name or "", desc or "", gtype)
            if slug is None:
                left += 1
                rows_out.append({"name": name, "action": "leave", "target": "", "reason": reason})
            else:
                refiled += 1
                rows_out.append({"name": name, "action": "refile", "target": slug, "reason": reason})
                if args.apply:
                    approve_category(cur, bid, cat_ids[slug], make_primary=True)
                    # The wrong search-phrase claim leaves the human queue.
                    cur.execute(
                        """
                        UPDATE "BusinessCategory"
                        SET "reviewStatus"='REJECTED'::"ReviewStatus"
                        WHERE "businessId"=%s AND "categoryId" = ANY(%s)
                          AND "reviewStatus"='PENDING_REVIEW'
                        """,
                        (bid, pending_ids),
                    )
                    _recompute_published(cur, bid)
            if args.apply and i % 200 == 0:
                conn.commit()
                print(f"  {i}/{len(queue)} · refile {refiled} leave {left}", flush=True)

        # 2) Published tour-typed businesses gain trail-rides (dual-list; never demote).
        cur.execute(
            """
            SELECT b.id, b.name, b."externalSourceId"
            FROM "Business" b
            WHERE b."isPublished" = true
              AND NOT EXISTS (
                SELECT 1 FROM "BusinessCategory" bc
                JOIN "Category" c ON c.id = bc."categoryId"
                WHERE bc."businessId" = b.id AND c.slug = %s
              )
            """,
            (TRAIL,),
        )
        for bid, name, ext in cur.fetchall():
            gtype = types.get(ext or "")
            hit = gtype and any(
                frag in gtype for frag, slug in DIRECT_TYPE_MAP if slug == TRAIL
            )
            if not hit and not re.search(r"trail rid|horseback rid|dude ranch|guest ranch|pony ride", name or "", re.I):
                continue
            trail_added += 1
            rows_out.append({"name": name, "action": "add-trail-rides", "target": TRAIL,
                             "reason": f"type:{gtype}" if hit else "name"})
            if args.apply:
                approve_category(cur, bid, cat_ids[TRAIL], make_primary=False)

        if args.apply:
            conn.commit()

    csv_path = OUT / "reclassify-decisions.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["name", "action", "target", "reason"])
        w.writeheader()
        w.writerows(rows_out)

    mode = "APPLIED" if args.apply else "DRY RUN (re-run with --apply)"
    print(f"\n{mode}: refiled {refiled} · trail-rides added {trail_added} · left {left}")
    print(f"Decisions written to {csv_path}")


if __name__ == "__main__":
    main()
