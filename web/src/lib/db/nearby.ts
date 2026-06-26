import { prisma } from "@/lib/prisma";
import { businessCardInclude, STABLES_SLUG, type BusinessCard } from "@/lib/db/business";

// Don't surface a stable as "near you" if it's farther than this. Keeps the
// section honest pre-national (a CA visitor shouldn't see Broward barns).
const MAX_KM = 250; // ~155 miles

export interface NearbyStable extends BusinessCard {
  distanceKm: number;
}

// Nearest published stables to a point, by great-circle distance. Raw SQL finds
// the closest ids (haversine, clamped to avoid acos domain errors), then we hydrate
// full card data and re-apply the distance order.
export async function getNearbyStables(
  lat: number,
  lng: number,
  take = 6,
): Promise<NearbyStable[]> {
  const rows = await prisma.$queryRaw<{ id: string; distance_km: number }[]>`
    SELECT b."id",
      6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(${lat})) * cos(radians(b."latitude")) *
          cos(radians(b."longitude") - radians(${lng}))
        + sin(radians(${lat})) * sin(radians(b."latitude"))
      ))) AS distance_km
    FROM "Business" b
    WHERE b."isPublished" = true
      AND b."latitude" IS NOT NULL AND b."longitude" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "BusinessCategory" bc
        JOIN "Category" c ON c."id" = bc."categoryId"
        WHERE bc."businessId" = b."id"
          AND bc."reviewStatus" IN ('AUTO_APPROVED', 'APPROVED')
          AND c."slug" = ${STABLES_SLUG}
      )
    ORDER BY distance_km ASC
    LIMIT ${take}
  `;

  const near = rows.filter((r) => r.distance_km <= MAX_KM);
  if (near.length === 0) return [];

  const distById = new Map(near.map((r) => [r.id, r.distance_km]));
  const cards = await prisma.business.findMany({
    where: { id: { in: near.map((r) => r.id) } },
    include: businessCardInclude,
  });
  return cards
    .map((c) => ({ ...c, distanceKm: distById.get(c.id) ?? Infinity }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
