import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { businessCardInclude, type BusinessCard } from "@/lib/db/business";

// Spotlight placement data layer (specs/monetization-tiers.md §"Public display").
// A Spotlight is active when now ∈ [startsAt, endsAt] and status === "active".
// Public surfaces show at most MAX_SPOTLIGHTS_PER_CITY active spotlights per city,
// auto-rotating weekly: round-robin by startsAt so the slot rotates as windows
// begin/expire (a deterministic, on-read rotation — no scheduler needed).

export const MAX_SPOTLIGHTS_PER_CITY = 3;

// A spotlight row paired with the business card it features (for rendering).
export type FeaturedSpotlight = {
  spotlightId: string;
  business: BusinessCard;
};

// Active spotlights covering `now` for a single city (locationId). Spotlights are
// scoped to a city; this matches that city directly (not descendants). Capped at
// MAX_SPOTLIGHTS_PER_CITY, rotated round-robin by startsAt (oldest-active first),
// excluding unpublished businesses.
export async function getActiveSpotlightsForLocation(
  locationId: string,
  now: Date = new Date(),
  limit = MAX_SPOTLIGHTS_PER_CITY,
): Promise<FeaturedSpotlight[]> {
  const rows = await prisma.spotlight.findMany({
    where: {
      locationId,
      status: "active",
      startsAt: { lte: now },
      endsAt: { gte: now },
      business: { isPublished: true },
    },
    // Round-robin by startsAt: the longest-running active window sorts first, so
    // the featured slot rotates as windows roll over week to week.
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: limit,
    include: { business: { include: businessCardInclude } },
  });

  // Dedup by business so one barn never occupies two of the three slots.
  const seen = new Set<string>();
  const out: FeaturedSpotlight[] = [];
  for (const r of rows) {
    if (seen.has(r.businessId)) continue;
    seen.add(r.businessId);
    out.push({ spotlightId: r.id, business: r.business });
  }
  return out;
}

// Active spotlights across a location subtree (city + its descendant cities under
// a county/state) — used by the county/state hub "Featured near you" block. We
// resolve the matching city ids first, then reuse the per-city query, preserving
// the round-robin order and the per-city cap, then cap the combined result.
export async function getActiveSpotlightsForArea(
  locationId: string,
  now: Date = new Date(),
  limit = MAX_SPOTLIGHTS_PER_CITY,
): Promise<FeaturedSpotlight[]> {
  const cityWhere: Prisma.LocationWhereInput = {
    OR: [
      { id: locationId },
      { parentId: locationId },
      { parent: { parentId: locationId } },
    ],
  };
  const cities = await prisma.location.findMany({
    where: cityWhere,
    select: { id: true },
  });
  const cityIds = cities.map((c) => c.id);
  if (cityIds.length === 0) return [];

  const rows = await prisma.spotlight.findMany({
    where: {
      locationId: { in: cityIds },
      status: "active",
      startsAt: { lte: now },
      endsAt: { gte: now },
      business: { isPublished: true },
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    include: { business: { include: businessCardInclude } },
  });

  const seen = new Set<string>();
  const out: FeaturedSpotlight[] = [];
  for (const r of rows) {
    if (seen.has(r.businessId)) continue;
    seen.add(r.businessId);
    out.push({ spotlightId: r.id, business: r.business });
    if (out.length >= limit) break;
  }
  return out;
}
