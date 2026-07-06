#!/usr/bin/env python3
"""AI moderation pass over the PENDING_REVIEW queue (the ~10K grade-1/2 claims).

The crawler's ingest-time grader flags any category assignment it can't confirm
(grade 1 = no evidence, grade 2 = suggestive) as PENDING_REVIEW instead of
publishing it. That leaves a large human queue in /admin/review. This tool works
that queue with AI instead of by hand:

  For each pending business, it fetches the business's own website (the evidence
  the ingest-time grader usually lacked), then re-grades each pending category
  with `grade_with_llm` (the same strict "explicit evidence or nothing" grader,
  with Gemini -> Claude -> OpenAI fallback). Decisions:

    grade 3 (CONFIRMED) & confidence >= --min-confidence  -> APPROVE (publishes it)
    grade 1 (NOT) *when real evidence was examined*        -> REJECT
    grade 2, or grade 1 with no website to check           -> LEAVE for a human

  It is deliberately conservative: it only rejects when it actually looked at the
  business's site (or the site was unreachable AND the name carries no positive
  signal) — so a real farrier named "ABC Services" with a thin listing is left
  for a human, never auto-rejected on missing text.

Read-only by default: writes out/ai-moderation-decisions.csv for review.
--apply commits the approvals/rejections (identical writes to moderate.py and
the /admin/review UI: approve -> GRADE_3_CONFIRMED/APPROVED + recompute
isPublished; reject -> REJECTED), each with an AuditLog row.

Usage (crawler folder; DATABASE_URL + a grading provider key set):
  python ai_moderate.py                     # dry run over the whole queue
  python ai_moderate.py --state WA --limit 200
  python ai_moderate.py --apply             # commit decisions
  python ai_moderate.py --no-fetch          # grade on name/description only (fast, approve-only)
  python ai_moderate.py --min-confidence 0.7
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

from equine_crawler.db import connect
from equine_crawler.grading_llm import grade_with_llm
from equine_crawler.schemas import Grade
from moderate import _recompute_published, _set_category

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OUT = Path("out")
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def fetch_site_text(url: str, *, timeout: float = 8.0, max_chars: int = 8000) -> str | None:
    """Best-effort fetch of a business site, stripped to plain text. Returns None
    on any failure (unreachable, non-HTML, timeout) — the grader then works from
    name/description only, and the reject path is disabled for that record."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "StableDirectoryBot/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            ctype = resp.headers.get("Content-Type", "")
            if "html" not in ctype and "text" not in ctype:
                return None
            raw = resp.read(600_000).decode("utf-8", errors="replace")
    except Exception:
        return None
    # Drop scripts/styles, strip tags, collapse whitespace.
    raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    text = _WS_RE.sub(" ", _TAG_RE.sub(" ", raw)).strip()
    return text[:max_chars] or None


def load_queue(cur, state: str | None, limit: int | None) -> list[dict]:
    """Businesses with >=1 PENDING_REVIEW grade-1/2 category, with their pending
    category slugs + the text signals we grade on."""
    where = (
        "bc.\"reviewStatus\" = 'PENDING_REVIEW' "
        "AND bc.grade IN ('GRADE_1_NOT','GRADE_2_UNSURE')"
    )
    args: list = []
    if state:
        where += (
            ' AND b."locationId" IN (SELECT city.id FROM "Location" city '
            'JOIN "Location" co ON city."parentId"=co.id '
            'JOIN "Location" st ON co."parentId"=st.id '
            "WHERE st.type='STATE' AND upper(st.code)=upper(%s))"
        )
        args.append(state)
    cur.execute(
        f"""
        SELECT b.id, b.slug, b.name, b.description, b.address, b.website,
               array_agg(bc."categoryId") AS cat_ids,
               array_agg(c.slug)          AS cat_slugs
        FROM "BusinessCategory" bc
        JOIN "Business" b ON b.id = bc."businessId"
        JOIN "Category" c ON c.id = bc."categoryId"
        WHERE {where}
        GROUP BY b.id, b.slug, b.name, b.description, b.address, b.website
        ORDER BY b.name ASC
        {"LIMIT %s" if limit else ""}
        """,
        (*args, limit) if limit else tuple(args),
    )
    cols = ["id", "slug", "name", "description", "address", "website", "cat_ids", "cat_slugs"]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def decide(biz: dict, *, fetch: bool, min_conf: float) -> list[dict]:
    """Grade each pending category for one business; return per-category decisions.
    decision ∈ {approve, reject, leave}."""
    site_text = fetch_site_text(biz["website"]) if (fetch and biz.get("website")) else None
    had_evidence = site_text is not None
    texts = [biz.get("name") or "", biz.get("description") or "", biz.get("address") or ""]
    if site_text:
        texts.append(site_text)

    try:
        graded = grade_with_llm(list(biz["cat_slugs"]), *texts)
    except Exception as exc:  # provider failure — leave the whole business alone
        return [
            {"category_id": cid, "category_slug": slug, "decision": "leave",
             "confidence": 0.0, "evidence": f"grading error: {exc}"}
            for cid, slug in zip(biz["cat_ids"], biz["cat_slugs"])
        ]

    by_slug = {g.category_slug: g for g in graded}
    out = []
    for cid, slug in zip(biz["cat_ids"], biz["cat_slugs"]):
        g = by_slug.get(slug)
        if g is None:
            out.append({"category_id": cid, "category_slug": slug, "decision": "leave",
                        "confidence": 0.0, "evidence": "no result"})
            continue
        if g.grade == Grade.CONFIRMED and g.confidence >= min_conf:
            decision = "approve"
        elif g.grade == Grade.NOT and had_evidence:
            # Only reject when we actually examined the business's own site and
            # still found no evidence — never on missing text alone.
            decision = "reject"
        else:
            decision = "leave"
        out.append({"category_id": cid, "category_slug": slug, "decision": decision,
                    "confidence": round(g.confidence, 2), "evidence": (g.evidence_quote or "")[:200]})
    return out


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="commit decisions (default: dry run)")
    ap.add_argument("--state", help="2-letter state code to scope to")
    ap.add_argument("--limit", type=int, help="cap number of businesses (good for a first pass)")
    ap.add_argument("--no-fetch", dest="fetch", action="store_false", help="skip website fetch (fast; approve-only)")
    ap.add_argument("--min-confidence", type=float, default=0.6, help="min confidence to auto-approve (default 0.6)")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    counts = {"approve": 0, "reject": 0, "leave": 0}
    rows_out: list[dict] = []

    with connect() as conn, conn.cursor() as cur:
        queue = load_queue(cur, args.state, args.limit)
        print(f"Pending businesses to review: {len(queue)}"
              f"{f' (state={args.state})' if args.state else ''}"
              f"{' — DRY RUN' if not args.apply else ''}\n")

        for i, biz in enumerate(queue, 1):
            decisions = decide(biz, fetch=args.fetch, min_conf=args.min_confidence)
            for d in decisions:
                counts[d["decision"]] += 1
                rows_out.append({"slug": biz["slug"], "name": biz["name"], **d})
                if args.apply and d["decision"] in ("approve", "reject"):
                    _set_category(cur, biz["id"], d["category_id"], d["decision"] == "approve")
            if args.apply and any(d["decision"] in ("approve", "reject") for d in decisions):
                _recompute_published(cur, biz["id"])
                conn.commit()
            if i % 50 == 0 or i == len(queue):
                print(f"  {i}/{len(queue)} · approve {counts['approve']} "
                      f"reject {counts['reject']} leave {counts['leave']}", flush=True)

    csv_path = OUT / "ai-moderation-decisions.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["slug", "name", "category_slug", "decision", "confidence", "evidence"])
        w.writeheader()
        for r in rows_out:
            w.writerow({k: r.get(k, "") for k in w.fieldnames})

    mode = "APPLIED" if args.apply else "DRY RUN (re-run with --apply)"
    print(f"\n{mode}: approve {counts['approve']} · reject {counts['reject']} · leave {counts['leave']}")
    print(f"Decisions written to {csv_path}")
    if args.apply:
        url, secret = os.environ.get("REVALIDATE_URL"), os.environ.get("REVALIDATE_SECRET")
        if url and secret:
            try:
                req = urllib.request.Request(url, method="POST", headers={"x-revalidate-secret": secret})
                urllib.request.urlopen(req, timeout=10)
                print("Pinged revalidate — newly published listings will refresh.")
            except Exception as exc:
                print(f"(revalidate ping failed: {exc} — ISR will catch up)")


if __name__ == "__main__":
    main()
