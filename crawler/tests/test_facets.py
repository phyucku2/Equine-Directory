"""Facet inference tests (no network / DB required).

Run: cd crawler && python -m pytest -q   (or: python tests/test_facets.py)

The DB-side fill guards (empty-column + not-owner-edited) live in
pipeline/upsert._prefill_facets and are exercised by integration runs; here we
only assert the pure inference that feeds them.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from equine_crawler.facets import infer_facets  # noqa: E402


def test_infers_disciplines_and_board_types():
    out = infer_facets(
        "Sunrise Dressage & Eventing Stables",
        "Full board and pasture board available. We also offer field board.",
        ["horse_boarding_facility"],
    )
    assert "dressage" in out["disciplines"]
    assert "eventing" in out["disciplines"]
    assert set(out["boardTypes"]) == {"full", "pasture"}


def test_infers_training_types():
    out = infer_facets("Colt Starting Ranch", "Full training and colt starting.", None)
    assert "full-training" in out["trainingTypes"]
    assert "colt-starting" in out["trainingTypes"]


def test_dedupes_and_omits_empty():
    out = infer_facets("Trail Trail Pleasure Barn", "trail rides", [])
    assert out["disciplines"] == ["trail-pleasure"]  # deduped
    assert "boardTypes" not in out
    assert "trainingTypes" not in out


def test_empty_input_returns_empty():
    assert infer_facets(None, None, None) == {}
    assert infer_facets("", "", []) == {}


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("all facet tests passed")
