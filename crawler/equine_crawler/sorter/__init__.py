"""Sonnet 5 sorting layer (pipeline build brief §3).

Crawler output (already ingested into Business) -> batched claude-sonnet-5
classification -> reconciliation -> idempotent publish, with flagged records
routed to the human review queue. Entrypoint: crawler/sort.py.
"""

from .core import Decision, Reconciliation, chunk, reconcile, to_decisions
from .prompt import BUCKET_TO_SLUG, BUCKETS, SORTING_PROMPT

__all__ = [
    "Decision",
    "Reconciliation",
    "chunk",
    "reconcile",
    "to_decisions",
    "BUCKETS",
    "BUCKET_TO_SLUG",
    "SORTING_PROMPT",
]
