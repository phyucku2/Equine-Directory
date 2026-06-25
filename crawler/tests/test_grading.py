"""Grading heuristic tests (no network / API key required).

Run: cd crawler && python -m pytest -q   (or: python tests/test_grading.py)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from equine_crawler.grading import grade_heuristic, grade_listing  # noqa: E402
from equine_crawler.schemas import Grade  # noqa: E402


def test_explicit_boarding_is_confirmed():
    g = grade_heuristic("horse-boarding", "Full board and pasture board available, $700/month.")
    assert g.grade == Grade.CONFIRMED
    assert g.evidence_quote


def test_stalls_only_is_unsure():
    g = grade_heuristic("horse-boarding", "Quiet farm with several stalls, a barn and an arena.")
    assert g.grade == Grade.UNSURE


def test_no_evidence_is_not():
    g = grade_heuristic("horse-boarding", "Cattle grazing and land management operation.")
    assert g.grade == Grade.NOT


def test_primary_is_highest_grade():
    graded = grade_listing(
        ["horse-boarding", "trainer-instructor"],
        "Pegasus Riding Academy",
        "We offer riding lessons and horse training. Dressage coaching.",
        use_llm=False,
    )
    primary = [g for g in graded if g.is_primary]
    assert len(primary) == 1
    assert primary[0].category_slug == "trainer-instructor"
    assert primary[0].grade == Grade.CONFIRMED


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("all grading tests passed")
