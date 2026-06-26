"""Pydantic schemas for the crawler pipeline.

Raw extraction -> grading -> normalized listing -> DB upsert. The grading model
mirrors the web app's BusinessCategory grade (specs/spec.md):
  3 = CONFIRMED (auto-publish), 2 = UNSURE, 1 = NOT (1 & 2 -> human review).
"""

from __future__ import annotations

from enum import IntEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class Grade(IntEnum):
    NOT = 1  # no evidence the business is in this category
    UNSURE = 2  # suggestive but inconclusive
    CONFIRMED = 3  # explicit evidence found

    @property
    def db_grade(self) -> str:
        return {1: "GRADE_1_NOT", 2: "GRADE_2_UNSURE", 3: "GRADE_3_CONFIRMED"}[int(self)]

    @property
    def review_status(self) -> str:
        # Only grade 3 auto-publishes; 1 & 2 go to the moderation queue.
        return "AUTO_APPROVED" if self == Grade.CONFIRMED else "PENDING_REVIEW"


class RawListing(BaseModel):
    """A listing as extracted from a source, before normalization/grading."""

    name: str
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    website: str | None = None
    description: str | None = None
    # Exact coordinates when the source provides them (e.g. Google Places);
    # falls back to the seeded city centroid during geocoding.
    latitude: float | None = None
    longitude: float | None = None
    # Candidate category slugs proposed by the source (to be graded).
    candidate_categories: list[str] = Field(default_factory=list)
    source_url: str | None = None
    external_id: str | None = None

    @field_validator("name")
    @classmethod
    def _name_nonempty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("name is required")
        return v


class GradedCategory(BaseModel):
    """Result of grading one candidate category for a business."""

    category_slug: str
    grade: Grade
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    evidence_quote: str | None = None
    is_primary: bool = False


class NormalizedListing(BaseModel):
    """A cleaned, geocoded, graded listing ready for upsert."""

    name: str
    slug: str
    address: str
    city: str | None = None
    phone: str | None = None
    website: str | None = None
    description: str | None = None
    latitude: float
    longitude: float
    location_id: str
    graded_categories: list[GradedCategory]
    source_url: str | None = None
    external_id: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)

    @property
    def is_published(self) -> bool:
        return any(gc.grade == Grade.CONFIRMED for gc in self.graded_categories)
