"""Anthropic Messages API call for one sorting batch (brief §3, Sonnet 5).

Retry-not-fallback: on a transport error, timeout, empty/unparseable response,
or a failed reconciliation, the caller retries the same batch. This module
never invents fallback classification logic — that would launder bad data into
production (brief Phase 3 step 2).
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

from .core import extract_json_object, reconcile
from .prompt import SORTING_PROMPT

MODEL = "claude-sonnet-5"


class SorterError(RuntimeError):
    """A batch that could not be classified after all retries."""


def _sort_once(client: Any, records: list[dict[str, Any]], *, effort: str, max_tokens: int) -> dict[str, Any]:
    """One Sonnet call for a batch. Streams (large max_tokens would otherwise
    risk an HTTP timeout) and returns the parsed JSON object."""
    payload = json.dumps(records, ensure_ascii=False)
    # thinking is disabled and effort kept low by default: this is high-volume,
    # well-specified classification, exactly the cheap-model job the brief §4
    # routes to Sonnet. Reconciliation + retry catches the rare miss.
    with client.messages.stream(
        model=MODEL,
        max_tokens=max_tokens,
        system=SORTING_PROMPT,
        thinking={"type": "disabled"},
        output_config={"effort": effort},
        messages=[{"role": "user", "content": payload}],
    ) as stream:
        message = stream.get_final_message()

    if message.stop_reason == "refusal":
        raise SorterError("model refused the batch")
    if message.stop_reason == "max_tokens":
        # Output truncated — the JSON object is incomplete; treat as a failure
        # so the caller retries (ideally with a smaller batch).
        raise SorterError("response hit max_tokens (batch too large); reduce --batch-size")
    text = "".join(b.text for b in message.content if getattr(b, "type", None) == "text")
    return extract_json_object(text)


def sort_batch(
    client: Any,
    records: list[dict[str, Any]],
    *,
    effort: str = "low",
    max_tokens: int = 32000,
    max_retries: int = 4,
) -> dict[str, Any]:
    """Classify one batch, retrying on failure or reconciliation mismatch.

    Returns the parsed, reconciled response object. Raises SorterError if the
    batch never reconciles — the caller logs it and moves on rather than
    merging a batch that dropped or invented records.
    """
    input_ids = [str(r["source_id"]) for r in records]
    last_err: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            response = _sort_once(client, records, effort=effort, max_tokens=max_tokens)
            rec = reconcile(input_ids, response)
            if rec.ok:
                return response
            last_err = SorterError(
                f"reconciliation failed: missing={len(rec.missing)} extra={len(rec.extra)} "
                f"dupes={len(rec.duplicates)} unknown_buckets={rec.unknown_buckets}"
            )
        except Exception as exc:  # noqa: BLE001 — retry any failure, don't fall back
            last_err = exc
        if attempt < max_retries:
            time.sleep(min(2 ** attempt, 16))
    raise SorterError(f"batch failed after {max_retries} attempts: {last_err}")


def make_client() -> Any:
    """Construct the Anthropic client. Resolves ANTHROPIC_API_KEY (or an
    `ant auth login` profile) via the SDK's normal precedence."""
    import anthropic

    if not os.environ.get("ANTHROPIC_API_KEY"):
        # Not fatal — the SDK can still resolve an OAuth profile — but the common
        # local case is a missing key, so surface a clear hint.
        print("  note: ANTHROPIC_API_KEY not set; relying on SDK credential resolution")
    return anthropic.Anthropic()
