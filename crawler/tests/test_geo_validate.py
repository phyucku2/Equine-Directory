"""validated_geo(): the listing's own address/coords beat the query tag.

Regression tests for the phantom-city bug: gosom results inherit the county|ST
of the query that returned them, and Google pads sparse rural queries with
out-of-area results — a Southwest Ranches FL barn returned by "horse boarding
Floyd County Indiana" was filed as Floyd County IN.
"""

from equine_crawler.pipeline.geo_validate import (
    VETO_KM,
    address_state,
    nearest_state,
    state_distance_km,
    validated_geo,
)

# Southwest Ranches, FL (Broward) — the observed misfile victim.
SWR_LAT, SWR_LNG = 26.0587, -80.3373
SWR_ADDR = "13500 Stirling Rd, Southwest Ranches, FL 33330"


def test_address_state_with_zip():
    assert address_state(SWR_ADDR) == "FL"


def test_address_state_trailing_no_zip():
    assert address_state("123 Main St, Ocala, FL") == "FL"


def test_address_state_none_for_unparseable():
    assert address_state("somewhere with no state") is None
    assert address_state(None) is None
    # A trailing pair that isn't a real state code is rejected.
    assert address_state("123 Road, Township, ZZ 99999") is None


def test_regression_fl_barn_from_indiana_query():
    """The exact observed bug: FL barn tagged Floyd|IN loses the tag."""
    county, state = validated_geo("Floyd", "IN", SWR_ADDR, SWR_LAT, SWR_LNG)
    assert county is None
    assert state == "FL"


def test_consistent_tag_is_kept():
    county, state = validated_geo("Broward", "FL", SWR_ADDR, SWR_LAT, SWR_LNG)
    assert county == "Broward"
    assert state == "FL"


def test_no_address_coords_veto_wrong_state():
    """No parseable address: coordinates alone veto a far-away query state."""
    county, state = validated_geo("Floyd", "IN", None, SWR_LAT, SWR_LNG)
    assert county is None
    assert state == "FL"  # nearest centroid to South Florida is FL


def test_no_address_coords_keep_plausible_state():
    county, state = validated_geo("Marion", "FL", None, SWR_LAT, SWR_LNG)
    assert county == "Marion"
    assert state == "FL"


def test_no_signals_passes_tag_through():
    county, state = validated_geo("Marion", "FL", None, None, None)
    assert county == "Marion"
    assert state == "FL"


def test_distance_math_sane():
    # South Florida to Indiana's centroid is way past the veto threshold...
    assert state_distance_km("IN", SWR_LAT, SWR_LNG) > VETO_KM
    # ...while Florida's own centroid is comfortably inside it.
    assert state_distance_km("FL", SWR_LAT, SWR_LNG) < VETO_KM
    assert nearest_state(SWR_LAT, SWR_LNG) == "FL"
