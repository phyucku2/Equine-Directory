"""Cleaning & slugging for raw listings."""

from __future__ import annotations

import re

from ..schemas import RawListing

_SLUG_STRIP = re.compile(r"[^a-z0-9]+")
_PHONE_DIGITS = re.compile(r"[^\d+]")


def slugify(*parts: str) -> str:
    joined = "-".join(p for p in parts if p)
    return _SLUG_STRIP.sub("-", joined.lower()).strip("-")


def clean_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = _PHONE_DIGITS.sub("", phone)
    return digits or None


def clean_url(url: str | None) -> str | None:
    if not url:
        return None
    url = url.strip()
    if url.startswith("//"):
        url = "https:" + url
    if url and not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url or None


def clean_text(text: str | None) -> str | None:
    if not text:
        return None
    return re.sub(r"\s+", " ", text).strip() or None


# US state-suffixed city extraction, e.g. "..., Ocala, FL 34482" -> "Ocala".
_CITY_RE = re.compile(r",\s*([A-Za-z][A-Za-z .'-]+),\s*FL\b", re.I)


def infer_city(raw: RawListing) -> str | None:
    if raw.city:
        return clean_text(raw.city)
    if raw.address:
        m = _CITY_RE.search(raw.address)
        if m:
            return clean_text(m.group(1))
    return None


def normalize(raw: RawListing) -> RawListing:
    return RawListing(
        name=clean_text(raw.name) or raw.name,
        address=clean_text(raw.address),
        city=infer_city(raw),
        county=clean_text(raw.county),
        phone=clean_phone(raw.phone),
        website=clean_url(raw.website),
        description=clean_text(raw.description),
        latitude=raw.latitude,
        longitude=raw.longitude,
        candidate_categories=raw.candidate_categories,
        source_url=raw.source_url,
        external_id=raw.external_id,
        primary_type=raw.primary_type,
        types=raw.types,
        rating=raw.rating,
        rating_count=raw.rating_count,
        business_status=raw.business_status,
        hours=raw.hours,
        google_maps_uri=raw.google_maps_uri,
        photos=raw.photos,
    )
