"""Sonnet-5 sorter core tests (no network / DB required).

Run: cd crawler && python -m pytest -q   (or: python tests/test_sorter.py)

Covers the pure pipeline logic — batching, JSON extraction, reconciliation
(input == bucketed + review_queue, exactly once), and flattening a batch
response to per-record decisions with the bucket->slug map. The DB apply path
(idempotent publish, Report routing) is exercised by integration runs.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from equine_crawler.sorter.core import (  # noqa: E402
    chunk,
    extract_json_object,
    reconcile,
    to_decisions,
)
from equine_crawler.sorter.prompt import BUCKET_TO_SLUG  # noqa: E402


def _resp(buckets=None, review=None):
    base = {b: [] for b in BUCKET_TO_SLUG}
    base.update(buckets or {})
    return {"buckets": base, "review_queue": review or []}


def test_chunk_splits_evenly_and_remainder():
    assert list(chunk([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]]
    assert list(chunk([], 3)) == []


def test_extract_json_handles_fence_and_prose():
    text = 'Here you go:\n```json\n{"a": 1, "b": [2, 3]}\n```\nthanks'
    assert extract_json_object(text) == {"a": 1, "b": [2, 3]}


def test_extract_json_raises_without_object():
    try:
        extract_json_object("no json here")
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_reconcile_ok_when_every_id_once():
    resp = _resp(
        buckets={"boarding": [{"source_id": "a"}, {"source_id": "b"}]},
        review=[{"source_id": "c", "reason": "x"}],
    )
    r = reconcile(["a", "b", "c"], resp)
    assert r.ok
    assert r.input_count == 3 and r.output_count == 3


def test_reconcile_flags_missing_extra_dupes():
    resp = _resp(
        buckets={"boarding": [{"source_id": "a"}, {"source_id": "a"}, {"source_id": "z"}]},
    )
    r = reconcile(["a", "b"], resp)
    assert not r.ok
    assert r.missing == ["b"]
    assert r.extra == ["z"]
    assert r.duplicates == ["a"]


def test_reconcile_flags_unknown_bucket():
    resp = {"buckets": {"made_up_bucket": [{"source_id": "a"}]}, "review_queue": []}
    r = reconcile(["a"], resp)
    assert r.unknown_buckets == ["made_up_bucket"]
    assert not r.ok


def test_to_decisions_maps_bucket_to_slug_and_review():
    resp = _resp(
        buckets={
            "boarding": [{"source_id": "a", "confidence": "high"}],
            "veterinary_equine_services": [{"source_id": "b", "confidence": "medium"}],
        },
        review=[{"source_id": "c", "reason": "skydiving company, not a stable"}],
    )
    decisions = {d.source_id: d for d in to_decisions(resp)}
    assert decisions["a"].action == "categorize"
    assert decisions["a"].slug == "horse-boarding"
    assert decisions["b"].slug == "equine-veterinarian"
    assert decisions["c"].action == "review"
    assert "skydiving" in decisions["c"].reason


def test_other_equine_routes_to_review():
    resp = _resp(buckets={"other_equine": [{"source_id": "x", "notes": "equine photographer"}]})
    d = to_decisions(resp)[0]
    assert d.action == "review"
    assert "other_equine" in d.reason and "photographer" in d.reason


def test_records_without_source_id_are_dropped_not_crashed():
    resp = _resp(buckets={"boarding": [{"name": "no id here"}, {"source_id": "ok"}]})
    ids = [d.source_id for d in to_decisions(resp)]
    assert ids == ["ok"]


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("all sorter tests passed")
