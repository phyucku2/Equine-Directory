import { prisma } from "@/lib/prisma";
import {
  businessCardInclude,
  NON_BARN_NAME_KEYWORDS,
  STABLES_SLUG,
  type BusinessCard,
} from "@/lib/db/business";

// Don't surface a stable as "near you" if it's farther than this. Keeps the
// section honest pre-national (a CA visitor shouldn't see Broward barns).
const MAX_KM = 250; // ~155 miles

// ILIKE patterns for the non-barn name exclusion in the raw geo queries (mirrors
// NOT_NON_BARN_NAME in business.ts). `name NOT ILIKE ALL(...)` keeps a row only
// when it matches none of these. See post-launch-fixes.md §2.
const NON_BARN_NAME_PATTERNS = NON_BARN_NAME_KEYWORDS.map((kw) => `%${kw}%`);

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
      AND b."name" NOT ILIKE ALL(${NON_BARN_NAME_PATTERNS}::text[])
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

export interface NearbyCity {
  name: string;
  citySlug: string;
  countySlug: string | null;
  stateSlug: string | null;
  barnCount: number;
  distanceKm: number;
}

// Cities nearest the visitor that actually have published stables, by distance.
// We group barns (which always carry lat/lng) by their city Location rather than
// relying on Location.latitude (often null), so a city's distance = its closest
// barn. Powers the geo-localized "Stables near you" city list on the homepage —
// a Pompano Beach visitor sees Fort Lauderdale / Coral Springs / Boca first,
// while crawlers keep the static hub list (post-launch-fixes.md §1).
export async function getNearbyCities(
  lat: number,
  lng: number,
  take = 6,
): Promise<NearbyCity[]> {
  const rows = await prisma.$queryRaw<
    {
      name: string;
      city_slug: string;
      county_slug: string | null;
      state_slug: string | null;
      barn_count: number;
      distance_km: number;
    }[]
  >`
    SELECT * FROM (
      SELECT DISTINCT ON (lower(name)) * FROM (
        SELECT city."name" AS name,
          city."slug" AS city_slug,
          county."slug" AS county_slug,
          state."slug" AS state_slug,
          COUNT(*)::int AS barn_count,
          MIN(6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(${lat})) * cos(radians(b."latitude")) *
              cos(radians(b."longitude") - radians(${lng}))
            + sin(radians(${lat})) * sin(radians(b."latitude"))
          )))) AS distance_km
        FROM "Business" b
        JOIN "Location" city ON city."id" = b."locationId"
        LEFT JOIN "Location" county ON county."id" = city."parentId"
        LEFT JOIN "Location" state ON state."id" = county."parentId"
        WHERE b."isPublished" = true
          AND b."latitude" IS NOT NULL AND b."longitude" IS NOT NULL
          AND b."name" NOT ILIKE ALL(${NON_BARN_NAME_PATTERNS}::text[])
          AND EXISTS (
            SELECT 1 FROM "BusinessCategory" bc
            JOIN "Category" c ON c."id" = bc."categoryId"
            WHERE bc."businessId" = b."id"
              AND bc."reviewStatus" IN ('AUTO_APPROVED', 'APPROVED')
              AND c."slug" = ${STABLES_SLUG}
          )
        GROUP BY city."id", city."name", city."slug", county."slug", state."slug"
        HAVING MIN(6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(${lat})) * cos(radians(b."latitude")) *
              cos(radians(b."longitude") - radians(${lng}))
            + sin(radians(${lat})) * sin(radians(b."latitude"))
          )))) <= ${MAX_KM}
      ) grouped
      -- Collapse duplicate same-named city rows (the phantom-city crawl bug
      -- filed e.g. six "Southwest Ranches" under different wrong counties) to
      -- the nearest one, so visitors never see six identical tiles. The
      -- crawler-side repair (repair_locations.py) merges the rows for real;
      -- this keeps the read path clean regardless.
      ORDER BY lower(name), distance_km ASC
    ) deduped
    ORDER BY distance_km ASC
    LIMIT ${take}
  `;

  return rows.map((r) => ({
    name: r.name,
    citySlug: r.city_slug,
    countySlug: r.county_slug,
    stateSlug: r.state_slug,
    barnCount: Number(r.barn_count),
    distanceKm: r.distance_km,
  }));
}

// Featured barns for the visitor's AREA: paid/spotlight/hand-picked barns nearby
// first, then the best-rated local barns to fill. So the homepage "Featured"
// section is always local — and when nobody is paying for featured placement in
// the area, we "go straight into the barns that are there" (nearest, best-rated).
// Excludes reported (open Report), non-barn-named, and non-boarding, within MAX_KM.
export async function getFeaturedNearby(
  lat: number,
  lng: number,
  take = 6,
): Promise<BusinessCard[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT b."id" AS id,
        (b."isFeatured" OR EXISTS (
          SELECT 1 FROM "Spotlight" s
          WHERE s."businessId" = b."id" AND s."status" = 'active'
            AND s."startsAt" <= now() AND now() <= s."endsAt"
        )) AS featured,
        b."rating" AS rating,
        b."reviewCount" AS review_count,
        6371 * acos(LEAST(1, GREATEST(-1,
          cos(radians(${lat})) * cos(radians(b."latitude")) *
            cos(radians(b."longitude") - radians(${lng}))
          + sin(radians(${lat})) * sin(radians(b."latitude"))
        ))) AS distance_km
      FROM "Business" b
      WHERE b."isPublished" = true
        AND b."latitude" IS NOT NULL AND b."longitude" IS NOT NULL
        AND b."name" NOT ILIKE ALL(${NON_BARN_NAME_PATTERNS}::text[])
        AND NOT EXISTS (
          SELECT 1 FROM "Report" r WHERE r."businessId" = b."id" AND r."status" = 'open'
        )
        AND EXISTS (
          SELECT 1 FROM "BusinessCategory" bc
          JOIN "Category" c ON c."id" = bc."categoryId"
          WHERE bc."businessId" = b."id"
            AND bc."reviewStatus" IN ('AUTO_APPROVED', 'APPROVED')
            AND c."slug" = ${STABLES_SLUG}
        )
    ) t
    WHERE t.distance_km <= ${MAX_KM}
    ORDER BY t.featured DESC, t.rating DESC NULLS LAST, t.review_count DESC, t.distance_km ASC
    LIMIT ${take}
  `;
  if (rows.length === 0) return [];
  const order = new Map(rows.map((r, i) => [r.id, i]));
  const cards = await prisma.business.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: businessCardInclude,
  });
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
