#!/usr/bin/env python3
"""Backfill Business.email by scraping the website we already have on file.

The gmaps crawl captures name/phone/website/hours/rating but NOT email (Google
Maps doesn't expose it, and we don't run gosom's slow -email website pass). This
is the targeted alternative: for each published business that has a `website`
but no `email`, fetch its site and pull a contact address — so the claim-invite
and owner-alert emails (which send to Business.email) actually have somewhere to
go.

Only rows with a website and no email are touched, so it's cheap to re-run and
never clobbers an owner-entered address. Read-mostly + single-row updates by id,
so it won't deadlock against an ingest the way concurrent state ingests do.

Usage (crawler folder; DATABASE_URL set):
  python enrich_emails.py --dry-run --limit 200     # preview matches
  python enrich_emails.py --apply --limit 5000      # write found emails
"""

from __future__ import annotations

import argparse
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

import httpx
from dotenv import load_dotenv

from equine_crawler.db import connect

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

UA = "Mozilla/5.0 (compatible; StableDirectoryBot/1.0; +https://thestabledirectory.com/about)"

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

# Addresses that are never a real business contact: analytics/CDN/builder noise,
# placeholders, and asset filenames the regex catches (foo@2x.png).
JUNK_DOMAINS = {
    "sentry.io", "sentry-next.wixpress.com", "wixpress.com", "wix.com",
    "example.com", "example.org", "email.com", "domain.com", "yourdomain.com",
    "sentry.wixpress.com", "godaddy.com", "squarespace.com", "cloudflare.com",
    "schema.org", "w3.org", "googleapis.com", "gstatic.com", "jsdelivr.net",
    "cloudfront.net", "sentry-cdn.com", "wordpress.org", "wordpress.com",
}
JUNK_TLDS = {"png", "jpg", "jpeg", "gif", "webp", "svg", "css", "js", "ico", "webp"}
JUNK_LOCALPARTS = {"no-reply", "noreply", "no_reply", "your-email", "youremail",
                   "email", "name", "user", "username", "sentry"}
# Contact pages worth a second fetch when the homepage yields nothing.
CONTACT_PATHS = ("/contact", "/contact-us", "/about", "/contact.html")


def clean_website(url: str) -> str | None:
    url = (url or "").strip()
    if not url:
        return None
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url


def is_junk(addr: str) -> bool:
    addr = addr.lower()
    local, _, domain = addr.partition("@")
    if not domain:
        return True
    if domain in JUNK_DOMAINS:
        return True
    if domain.rsplit(".", 1)[-1] in JUNK_TLDS:
        return True
    if local in JUNK_LOCALPARTS:
        return True
    # asset-hash localparts like "logo@2x" already excluded by TLD, but also
    # drop anything with no dot in the domain (not a real FQDN).
    if "." not in domain:
        return True
    return False


def pick_email(candidates: list[str], site_host: str) -> str | None:
    seen: list[str] = []
    for c in candidates:
        c = c.strip().strip(".").lower()
        if c in seen or is_junk(c):
            continue
        seen.append(c)
    if not seen:
        return None
    # Prefer an address on the site's own domain (info@thebarn.com over a
    # gmail scraped from a third-party widget), else the first clean one.
    root = site_host.split(":")[0].removeprefix("www.")
    for c in seen:
        if c.split("@")[1].endswith(root):
            return c
    return seen[0]


def emails_from_html(html: str) -> list[str]:
    out: list[str] = []
    # mailto: links are the highest-signal source.
    for m in re.findall(r'mailto:([^"\'?>\s]+)', html, re.I):
        out.append(m)
    out.extend(EMAIL_RE.findall(html))
    return out


def find_email(website: str, client: httpx.Client) -> str | None:
    url = clean_website(website)
    if not url:
        return None
    host = urlparse(url).netloc
    pages: list[str] = []
    try:
        r = client.get(url)
        if r.status_code < 400 and r.text:
            pages.append(r.text[:500_000])
            base = str(r.url)
        else:
            base = url
    except Exception:
        return None

    cands = emails_from_html(pages[0]) if pages else []
    picked = pick_email(cands, host)
    if picked:
        return picked

    # Nothing on the homepage — try one contact/about page.
    for path in CONTACT_PATHS:
        try:
            r = client.get(urljoin(base, path))
            if r.status_code < 400 and r.text:
                picked = pick_email(emails_from_html(r.text[:500_000]), host)
                if picked:
                    return picked
        except Exception:
            continue
    return None


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="write found emails (default: dry run)")
    ap.add_argument("--limit", type=int, default=2000, help="max businesses to check")
    ap.add_argument("--workers", type=int, default=8, help="concurrent fetches")
    ap.add_argument("--include-unpublished", action="store_true",
                    help="also scrape barns not yet published (whole DB ceiling, not just live listings)")
    args = ap.parse_args()

    # Published-only is the safe default (we only email/keep addresses for live
    # listings). --include-unpublished widens to the whole table to measure the
    # true email ceiling — how many barns anywhere have a scrapeable website.
    conds = ["website IS NOT NULL AND website <> ''", "(email IS NULL OR email = '')"]
    if not args.include_unpublished:
        conds.insert(0, '"isPublished" = true')
    where = "WHERE " + " AND ".join(conds)
    scope = "all barns" if args.include_unpublished else "published"

    with connect() as conn, conn.cursor() as cur:
        # Unbounded ceiling first, so we see the true candidate total even when
        # --limit caps how many we actually scrape this run.
        cur.execute(f'SELECT count(*) FROM "Business" {where}')
        total_candidates = cur.fetchone()[0]
        cur.execute(
            f"""
            SELECT id, name, website
            FROM "Business"
            {where}
            ORDER BY "reviewCount" DESC NULLS LAST
            LIMIT %s
            """,
            (args.limit,),
        )
        rows = cur.fetchall()
        print(f"Ceiling — {scope} with website & no email: {total_candidates}", flush=True)
        print(f"Checking this run (limit {args.limit}): {len(rows)}"
              f"{'' if args.apply else ' — DRY RUN'}", flush=True)

        found = updated = 0
        timeout = httpx.Timeout(10.0, connect=8.0)
        limits = httpx.Limits(max_connections=args.workers)
        with httpx.Client(
            headers={"User-Agent": UA}, follow_redirects=True, timeout=timeout,
            limits=limits, verify=False,  # many small-barn sites have broken/expired certs
        ) as client:
            def work(row):
                bid, name, website = row
                return bid, name, website, find_email(website, client)

            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futures = [pool.submit(work, r) for r in rows]
                for i, fut in enumerate(as_completed(futures), 1):
                    bid, name, website, email = fut.result()
                    if email:
                        found += 1
                        print(f"  ✓ {email}  ←  {name}", flush=True)
                        if args.apply:
                            # Guard email IS NULL again so a concurrent claim
                            # (owner-entered address) always wins.
                            cur.execute(
                                'UPDATE "Business" SET email=%s, "updatedAt"=now() '
                                "WHERE id=%s AND (email IS NULL OR email='')",
                                (email, bid),
                            )
                            updated += cur.rowcount
                    if args.apply and i % 200 == 0:
                        conn.commit()
                        print(f"  … {i}/{len(rows)} · found {found} · updated {updated}", flush=True)
            if args.apply:
                conn.commit()

        mode = "APPLIED" if args.apply else "DRY RUN (re-run with --apply)"
        rate = f"{found / len(rows) * 100:.0f}%" if rows else "0%"
        print(f"\n{mode}: checked {len(rows)} · emails found {found} ({rate}) · updated {updated}")


if __name__ == "__main__":
    main()
