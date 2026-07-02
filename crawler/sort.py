#!/usr/bin/env python3
"""Sonnet 5 sorter — pipeline build brief Phase 3/4.

Reads published businesses (the crawler's staging view), classifies each in
batches via claude-sonnet-5 using the fixed sorting prompt, reconciles every
batch (input_count == bucketed + review_queue), then either previews the
changes (default) or applies them idempotently.

Apply routes flagged non-equine records to the human queue (unpublish + a
/admin/reports Report) and re-files mislabeled records to the correct primary
category. Records already filed correctly are left untouched.

Usage (run from the crawler folder, DATABASE_URL + ANTHROPIC_API_KEY set):
  python sort.py                       # DRY RUN — reconcile + write preview CSV, no DB writes
  python sort.py --state FL --limit 500 # scope to one state / cap rows (good for a first pass)
  python sort.py --apply               # write the changes
  python sort.py --batch-size 200 --effort low
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv

from equine_crawler.db import connect
from equine_crawler.pipeline.upsert import load_category_ids
from equine_crawler.sorter.client import SorterError, make_client, sort_batch
from equine_crawler.sorter.core import chunk, to_decisions
from equine_crawler.sorter.db import apply_decisions, fetch_records


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Sonnet 5 listing sorter")
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--state", default=None, help="scope to one state code, e.g. FL")
    ap.add_argument("--limit", type=int, default=None, help="cap rows sorted")
    ap.add_argument("--batch-size", type=int, default=200, help="records per Sonnet call (200-500)")
    ap.add_argument("--effort", default="low", choices=["low", "medium", "high"])
    ap.add_argument("--max-tokens", type=int, default=32000)
    args = ap.parse_args()

    out = Path("out")
    out.mkdir(exist_ok=True)
    client = make_client()

    with connect() as conn:
        cat_ids = load_category_ids(conn)
        records = fetch_records(conn, state=args.state, limit=args.limit)
        print(f"fetched {len(records)} published businesses"
              + (f" in {args.state}" if args.state else "")
              + f" | mode: {'APPLY' if args.apply else 'DRY RUN'}")
        if not records:
            print("nothing to sort.")
            return

        # Keep the maps the apply step needs; hand the model only the §3 fields.
        id_to_business = {r["source_id"]: r["business_id"] for r in records}
        current_slug = {r["source_id"]: r.get("primary_slug") for r in records}
        model_input = [
            {k: v for k, v in r.items() if k not in ("business_id", "primary_slug")}
            for r in records
        ]

        all_decisions = []
        failed_batches = 0
        batches = list(chunk(model_input, args.batch_size))
        for i, batch in enumerate(batches, 1):
            try:
                resp = sort_batch(
                    client, batch, effort=args.effort, max_tokens=args.max_tokens,
                )
            except SorterError as exc:
                failed_batches += 1
                print(f"  batch {i}/{len(batches)}: FAILED — {exc} (not merged)", flush=True)
                continue
            decisions = to_decisions(resp)
            all_decisions.extend(decisions)
            summ = resp.get("batch_summary", {})
            print(f"  batch {i}/{len(batches)}: {len(batch)} in -> "
                  f"{summ.get('review_queue_count', '?')} review, "
                  f"{len(decisions)} decisions", flush=True)

        # Split for reporting: which categorizations actually change a listing.
        review = [d for d in all_decisions if d.action == "review"]
        recat = [d for d in all_decisions if d.action == "categorize"
                 and current_slug.get(d.source_id) != d.slug]
        by_bucket = Counter(d.bucket for d in all_decisions if d.action == "categorize")

        print(f"\nsummary: {len(all_decisions)} decisions | {len(review)} -> review queue | "
              f"{len(recat)} recategorized | {failed_batches} batch(es) failed")
        print("bucket distribution:")
        for bucket, n in by_bucket.most_common():
            print(f"  {n:>6}  {bucket}")

        # Always write a preview so a human can eyeball before/after apply.
        preview = out / "sort-preview.csv"
        with preview.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["source_id", "action", "bucket", "from_slug", "to_slug", "reason", "confidence"])
            for d in all_decisions:
                w.writerow([d.source_id, d.action, d.bucket or "",
                            current_slug.get(d.source_id) or "", d.slug or "",
                            d.reason or "", d.confidence or ""])
        print(f"\npreview written to {preview}")

        if failed_batches:
            print(f"WARNING: {failed_batches} batch(es) never reconciled and were not merged. "
                  "Re-run to retry them (idempotent).")

        if not args.apply:
            print("\nDRY RUN — no DB writes. Re-run with --apply to write these changes.")
            return

        counts = apply_decisions(conn, all_decisions, id_to_business, current_slug, cat_ids)
        conn.commit()
        print(f"\napplied: {counts['categorized']} recategorized, {counts['reviewed']} sent to review, "
              f"{counts['unchanged']} already correct, {counts['skipped']} skipped")


if __name__ == "__main__":
    main()
