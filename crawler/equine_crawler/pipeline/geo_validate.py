"""Geographic validation: trust the listing's own evidence over the query tag.

Root cause of the phantom-city bug (six "Southwest Ranches" rows under Indiana/
Michigan/North Carolina counties): every gosom result inherits the county|state
of the SEARCH QUERY that returned it, and Google pads sparse rural queries with
out-of-area results. A South-Florida barn returned by "horse boarding Floyd
County Indiana" was filed as Floyd County IN — and once seed_counties.py made
every state's counties resolvable, resolve_or_create() faithfully created a
phantom "Southwest Ranches" city there, with the barn's real FL coordinates as
the city centroid.

The listing itself carries two far stronger signals than the query tag:
  1. Its own Google address, which ends "..., City, ST zip" — the ST is the
     listing's true state.
  2. Its exact coordinates, which can be checked against state centroids.

`validated_geo()` applies them in that order. The query tag is only kept when
it survives both checks; otherwise the county is dropped (the geocoder's
nearest-city-by-coords fallback is geographically exact) and the state is
corrected.
"""

from __future__ import annotations

import math
import re

from ..us_counties import STATE_META

# STATE_META is the auto-generated list of states that needed county seeding —
# Florida predates it and is absent. Centroid checks need the full lower 48.
STATE_CENTROIDS: dict[str, dict] = {
    **{code: {"lat": m["lat"], "lng": m["lng"]} for code, m in STATE_META.items()},
    "FL": {"lat": 27.994, "lng": -81.760},
}

# ", FL 33330" / ", FL 33330-1234" — the state code immediately before the zip
# is the most reliable form. The looser fallback matches a trailing ", FL" with
# no zip (rare in gosom output but present in some sources).
_STATE_ZIP_RE = re.compile(r",\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b")
_STATE_TRAIL_RE = re.compile(r",\s*([A-Z]{2})\s*$")

# A listing must lie within this distance of its claimed state's centroid to
# keep the query tag. Sized to the biggest lower-48 states (CA's centroid to
# Crescent City ~640 km; TX centroid to El Paso ~550 km) with headroom, while
# still catching every observed misfile class (FL -> IN is ~1,500 km).
VETO_KM = 750.0


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    rad = math.radians
    a = (
        math.sin(rad(lat2 - lat1) / 2) ** 2
        + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.sin(rad(lng2 - lng1) / 2) ** 2
    )
    return 6371.0 * 2 * math.asin(min(1.0, math.sqrt(a)))


def address_state(address: str | None) -> str | None:
    """The two-letter state code from the listing's own address, if present."""
    if not address:
        return None
    m = _STATE_ZIP_RE.search(address)
    if not m:
        m = _STATE_TRAIL_RE.search(address)
    if not m:
        return None
    code = m.group(1).upper()
    return code if code in STATE_CENTROIDS else None


def state_distance_km(code: str | None, lat: float | None, lng: float | None) -> float | None:
    """Distance from (lat, lng) to `code`'s state centroid, or None if unknowable."""
    if not code or lat is None or lng is None:
        return None
    meta = STATE_CENTROIDS.get(code.upper())
    if not meta:
        return None
    return _haversine_km(lat, lng, meta["lat"], meta["lng"])


def nearest_state(lat: float | None, lng: float | None) -> str | None:
    """The state whose centroid is nearest to (lat, lng). Border towns can land
    one state over (~tens of km of ambiguity) — callers use this only when the
    query tag has been vetoed by a >VETO_KM discrepancy, where it is far more
    trustworthy than the tag."""
    if lat is None or lng is None:
        return None
    best_code, best_km = None, float("inf")
    for code, meta in STATE_CENTROIDS.items():
        km = _haversine_km(lat, lng, meta["lat"], meta["lng"])
        if km < best_km:
            best_code, best_km = code, km
    return best_code


def validated_geo(
    query_county: str | None,
    query_state: str | None,
    address: str | None,
    lat: float | None,
    lng: float | None,
) -> tuple[str | None, str | None]:
    """Return (county, state) safe to hand to resolve_or_create().

    - The address's own state code wins over the query tag whenever they
      disagree (and the county tag is dropped with it — it described the query
      area, not this listing).
    - With no address state, coordinates veto a query state whose centroid is
      more than VETO_KM away, correcting to the nearest state by centroid.
    - A query tag that survives both checks is kept as-is.
    """
    a_state = address_state(address)
    q_state = (query_state or "").strip().upper() or None

    if a_state:
        if q_state and q_state != a_state:
            # Out-of-area result: the query found it, but it isn't there.
            return (None, a_state)
        # Tag agrees with (or lacks) the address state; keep the county only
        # when the coordinates don't contradict the state outright.
        km = state_distance_km(a_state, lat, lng)
        if km is not None and km > VETO_KM:
            # Address and coords disagree wildly — trust coords (address text
            # can be a mailing address); drop the county.
            return (None, nearest_state(lat, lng) or a_state)
        return (query_county if q_state else None, a_state)

    # No address state — fall back to coordinate check against the tag.
    if q_state:
        km = state_distance_km(q_state, lat, lng)
        if km is not None and km > VETO_KM:
            return (None, nearest_state(lat, lng) or None)
        return (query_county, q_state)

    return (query_county, None)
