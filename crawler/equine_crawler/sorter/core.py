"""Pure sorter logic: batching, response parsing, reconciliation, and turning a
Sonnet batch response into per-record decisions.

No DB, no network, no Anthropic import — everything here is unit-testable with
plain dicts (see crawler/tests/test_sorter.py). The reconciliation check
(brief Phase 3 step 3) lives here, in pipeline code, not only in the prompt's
instructions to itself.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Iterator

from .prompt import BUCKETS, BUCKET_TO_SLUG


def chunk(seq: list[Any], size: int) -> Iterator[list[Any]]:
    """Yield successive `size`-length batches from `seq`."""
    if size < 1:
        raise ValueError("batch size must be >= 1")
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def extract_json_object(text: str) -> dict[str, Any]:
    """Pull the single JSON object out of a model response.

    The prompt asks for a bare JSON object, but models occasionally wrap it in
    a ```json fence or a stray sentence. Slice from the first '{' to the last
    '}' and parse that. Raises ValueError if no object is present or it doesn't
    parse — the caller treats that as a batch failure and retries (never a
    silent fallback).
    """
    import json

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("no JSON object found in model response")
    return json.loads(text[start : end + 1])


@dataclass
class Decision:
    """One resolved record. action is 'categorize' (publish under `slug`) or
    'review' (route to the human queue with `reason`)."""

    source_id: str
    action: str  # "categorize" | "review"
    bucket: str | None = None
    slug: str | None = None
    reason: str | None = None
    confidence: str | None = None
    secondary_tags: list[str] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)


@dataclass
class Reconciliation:
    """Result of checking a batch response against its input (brief Phase 3
    step 3). `ok` is True only when every input id appears exactly once in the
    output and no unknown ids were invented."""

    input_count: int
    output_count: int
    missing: list[str]  # input ids absent from the response
    extra: list[str]  # response ids not in the input
    duplicates: list[str]  # ids appearing more than once in the response
    unknown_buckets: list[str]  # bucket keys not in BUCKETS

    @property
    def ok(self) -> bool:
        return not (self.missing or self.extra or self.duplicates or self.unknown_buckets)


def _iter_response_records(response: dict[str, Any]) -> Iterator[tuple[str, str, dict[str, Any]]]:
    """Yield (location, source_id, record) for every record in a response.

    location is the bucket name or "review_queue". Records missing a source_id
    are yielded with an empty id so reconciliation flags them.
    """
    buckets = response.get("buckets") or {}
    for bucket, records in buckets.items():
        for rec in records or []:
            yield bucket, str(rec.get("source_id", "")), rec
    for rec in response.get("review_queue") or []:
        yield "review_queue", str(rec.get("source_id", "")), rec


def reconcile(input_ids: Iterable[str], response: dict[str, Any]) -> Reconciliation:
    """Verify (bucketed + review_queue) == input, exactly once each."""
    input_set = {str(i) for i in input_ids}
    seen: dict[str, int] = {}
    unknown_buckets: list[str] = []
    for bucket, sid, _ in _iter_response_records(response):
        if bucket != "review_queue" and bucket not in BUCKETS:
            if bucket not in unknown_buckets:
                unknown_buckets.append(bucket)
        seen[sid] = seen.get(sid, 0) + 1
    output_ids = set(seen)
    return Reconciliation(
        input_count=len(input_set),
        output_count=sum(seen.values()),
        missing=sorted(input_set - output_ids),
        extra=sorted(output_ids - input_set - {""}),
        duplicates=sorted(k for k, n in seen.items() if n > 1 and k),
        unknown_buckets=unknown_buckets,
    )


def to_decisions(response: dict[str, Any]) -> list[Decision]:
    """Flatten a reconciled batch response into per-record Decisions.

    A bucket whose slug is None (only "other_equine") is routed to review with a
    reason drawn from the record's notes/flags, since there is no confident
    single stable category to publish it under.
    """
    decisions: list[Decision] = []
    for bucket, records in (response.get("buckets") or {}).items():
        slug = BUCKET_TO_SLUG.get(bucket)
        for rec in records or []:
            sid = str(rec.get("source_id", ""))
            if not sid:
                continue
            if slug is None:
                note = rec.get("notes") or (rec.get("flags") or [""])[0] or "other_equine"
                decisions.append(
                    Decision(source_id=sid, action="review", bucket=bucket,
                             reason=f"other_equine: {note}"[:512])
                )
            else:
                decisions.append(Decision(
                    source_id=sid, action="categorize", bucket=bucket, slug=slug,
                    confidence=rec.get("confidence"),
                    secondary_tags=list(rec.get("secondary_tags") or []),
                    flags=list(rec.get("flags") or []),
                ))
    for rec in response.get("review_queue") or []:
        sid = str(rec.get("source_id", ""))
        if not sid:
            continue
        decisions.append(Decision(
            source_id=sid, action="review",
            reason=(rec.get("reason") or "flagged by sorter")[:512],
        ))
    return decisions
