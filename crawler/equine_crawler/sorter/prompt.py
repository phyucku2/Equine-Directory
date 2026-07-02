"""The Sonnet 5 sorting prompt (pipeline build brief §3) and the pipeline's
bucket -> Category-slug map.

The SORTING_PROMPT is FIXED INPUT — it is the sorter's contract and must not be
edited as part of pipeline work (brief §2 Constraints). The bucket->slug map is
pipeline connective code (brief Phase 1 confirmed the real taxonomy differs from
the brief's generic bucket list), so reconciling the two lives here, not in the
prompt.
"""

from __future__ import annotations

# The ten buckets the sorter classifies into (brief §3 Step 2). Kept as a tuple
# so reconciliation can validate that every bucket key in a response is known.
BUCKETS: tuple[str, ...] = (
    "boarding",
    "training",
    "lessons_instruction",
    "trail_rides_guided",
    "breeding",
    "rescue_rehab",
    "veterinary_equine_services",
    "show_event_venue",
    "tack_feed_retail",
    "other_equine",
)

# Map each bucket to the authoritative Category slug it publishes under
# (web/prisma/seed/categories.ts). "other_equine" has no single clean stable
# category, so it routes to human review instead of publishing under a guess —
# publishing an "other" business under a wrong category is exactly the defect we
# are fixing, so it is treated like review_queue at apply time.
BUCKET_TO_SLUG: dict[str, str | None] = {
    "boarding": "horse-boarding",
    "training": "training-facilities",
    "lessons_instruction": "trainer-instructor",
    "trail_rides_guided": "recreational-trail-guest-ranch",
    "breeding": "breeding-facilities",
    "rescue_rehab": "rescues-sanctuaries",
    "veterinary_equine_services": "equine-veterinarian",
    "show_event_venue": "event-venue",
    "tack_feed_retail": "tack-shop",
    "other_equine": None,  # -> review queue (no confident single category)
}

# Verbatim from the pipeline build brief §3. Do not edit — the sorter's taxonomy
# and validation rules live here as fixed input.
SORTING_PROMPT = """\
You are the sorting layer in a data pipeline for The Stable Directory, a horse
stable and barn listing site. You receive batches of raw listing records
already extracted by a crawler. Your job is to classify every record into
the correct bucket(s) and flag records that don't belong at all — WITHOUT
deleting or silently dropping anything.

## Non-negotiable rule
Every single input record must appear exactly once in your output, either in
a category bucket or in the review_queue bucket. If you are unsure where a
record belongs, put it in review_queue with a reason — never omit it, never
skip it for being "obviously wrong," never summarize multiple records into
one. Output record count MUST equal input record count. Before you finish,
count both and confirm they match; if they don't, find the missing record
and add it.

## Input format
You will receive a JSON array of listing records. Fields may include: name,
category_raw (the label the crawler scraped from the site), city, county,
state, address, phone, latitude, longitude, rating, review_count, url,
description (if present). Fields may be missing or empty — treat missing
fields as a data-quality signal, not an error to stop on.

## Step 1 — Validate before you categorize
Check each record for these known failure patterns before assigning a
category:
1. Non-equestrian business — category_raw says something like "Boarding
   Facilities" but the name/description indicates a non-stable business
   (tour operators, skydiving, yoga studios, towing, boat charters,
   off-road/ATV rentals, etc.). Flag these.
2. Location mismatch — the state/county in the record disagrees with the
   state implied by the address, ZIP, or phone area code. Flag these.
3. Malformed name — the name field looks duplicated/concatenated. Flag but
   still classify if the underlying business is clearly a real stable.
4. Missing critical fields — no usable location or name. Flag these.

A record can be flagged AND still placed in a category bucket if you're
reasonably confident about the business type. Route to review_queue instead
only when you cannot confidently place it in any category bucket at all
(most commonly pattern 1).

## Step 2 — Category buckets
Assign each validated record to exactly one primary bucket from the list
below. If the taxonomy Fable 5 confirms from Phase 1 differs from this
list, use that authoritative list instead — do not invent categories.

- boarding
- training
- lessons_instruction
- trail_rides_guided
- breeding
- rescue_rehab
- veterinary_equine_services
- show_event_venue
- tack_feed_retail
- other_equine (explain in a notes field)

If a business clearly offers multiple services, assign the primary bucket
based on what it appears to lead with, and list the rest in secondary_tags.

## Step 3 — Location tagging
Attach state/county from whichever fields you trust most (prefer
address/ZIP over category_raw breadcrumbs when they conflict, and flag
the conflict per Step 1). If location can't be determined, set it to
"unknown" and flag it.

## Step 4 — review_queue
Each review_queue record needs a one-line, human-actionable reason
("category_raw is Boarding Facilities but this is a skydiving company" /
"state breadcrumb and address ZIP disagree").

## Output format
Return ONLY a single JSON object, no prose before or after:

{
  "batch_summary": {
    "input_count": <int>,
    "output_count": <int>,
    "flagged_count": <int>,
    "review_queue_count": <int>
  },
  "buckets": {
    "boarding": [ <record> ],
    "training": [ <record> ],
    "lessons_instruction": [ <record> ],
    "trail_rides_guided": [ <record> ],
    "breeding": [ <record> ],
    "rescue_rehab": [ <record> ],
    "veterinary_equine_services": [ <record> ],
    "show_event_venue": [ <record> ],
    "tack_feed_retail": [ <record> ],
    "other_equine": [ <record> ]
  },
  "review_queue": [ <record_with_reason> ]
}

Each <record> in a category bucket:
{
  "source_id": <original identifier or url, unchanged>,
  "name": <string>,
  "state": <string>,
  "county": <string>,
  "city": <string>,
  "secondary_tags": [<string>, ...],
  "flags": [<string>, ...],
  "confidence": "high" | "medium" | "low"
}

Each <record_with_reason> in review_queue:
{
  "source_id": <original identifier or url, unchanged>,
  "name": <string>,
  "reason": <one-line, specific, human-actionable>,
  "raw_category": <whatever category_raw said>
}

Do not translate, paraphrase, or "clean up" the business name — echo it
exactly as received, even if malformed.
"""
