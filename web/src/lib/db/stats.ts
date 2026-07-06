import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PUBLIC_CATEGORY_SLUGS } from "@/lib/catalog";

// Aggregate stats over the published catalog — powers the /data linkable-asset
// pages (digital-PR backlinks) and the per-page stat strips on hubs. All numbers
// are computed live from the directory, so studies stay current as the crawl
// grows. Cached at the page (ISR); these are a handful of grouped scans.

// Published + in a public catalog category — the same gate the public site uses,
// expressed for raw SQL (mirrors PUBLIC_BUSINESS_WHERE).
const PUBLISHED_CATALOG = Prisma.sql`
  b."isPublished" = true
  AND EXISTS (
    SELECT 1 FROM "BusinessCategory" bc
    JOIN "Category" c ON c."id" = bc."categoryId"
    WHERE bc."businessId" = b."id"
      AND bc."reviewStatus" IN ('AUTO_APPROVED', 'APPROVED')
      AND c."slug" IN (${Prisma.join(PUBLIC_CATEGORY_SLUGS)})
  )`;

export interface NationalStats {
  facilities: number;
  reviews: number;
  avgRating: number | null;
  states: number;
  cities: number;
}

export async function getNationalStats(): Promise<NationalStats> {
  const rows = await prisma.$queryRaw<
    { facilities: bigint; reviews: bigint; avg_rating: number | null; cities: bigint }[]
  >`
    SELECT count(*)::bigint AS facilities,
           coalesce(sum(b."reviewCount"), 0)::bigint AS reviews,
           avg(b."rating")::float AS avg_rating,
           count(DISTINCT b."locationId")::bigint AS cities
    FROM "Business" b
    WHERE ${PUBLISHED_CATALOG}
  `;
  const stateRows = await prisma.$queryRaw<{ states: bigint }[]>`
    SELECT count(DISTINCT st."id")::bigint AS states
    FROM "Business" b
    JOIN "Location" city ON city."id" = b."locationId"
    JOIN "Location" co ON co."id" = city."parentId"
    JOIN "Location" st ON st."id" = co."parentId" AND st."type" = 'STATE'
    WHERE ${PUBLISHED_CATALOG}
  `;
  const r = rows[0];
  return {
    facilities: Number(r?.facilities ?? 0),
    reviews: Number(r?.reviews ?? 0),
    avgRating: r?.avg_rating != null ? Math.round(r.avg_rating * 100) / 100 : null,
    states: Number(stateRows[0]?.states ?? 0),
    cities: Number(r?.cities ?? 0),
  };
}

export interface StateCount {
  code: string;
  name: string;
  slug: string;
  facilities: number;
}

// Facility count per state, ranked. The core "which states have the most equine
// facilities" study + the state directory.
export async function getStateCounts(): Promise<StateCount[]> {
  const rows = await prisma.$queryRaw<
    { code: string | null; name: string; slug: string; facilities: bigint }[]
  >`
    SELECT st."code" AS code, st."name" AS name, st."slug" AS slug,
           count(*)::bigint AS facilities
    FROM "Business" b
    JOIN "Location" city ON city."id" = b."locationId"
    JOIN "Location" co ON co."id" = city."parentId"
    JOIN "Location" st ON st."id" = co."parentId" AND st."type" = 'STATE'
    WHERE ${PUBLISHED_CATALOG}
    GROUP BY st."id", st."code", st."name", st."slug"
    ORDER BY facilities DESC
  `;
  return rows.map((r) => ({
    code: r.code ?? "",
    name: r.name,
    slug: r.slug,
    facilities: Number(r.facilities),
  }));
}

export interface CategoryCount {
  slug: string;
  name: string;
  facilities: number;
}

// Facility count per catalog category (a business can count in several).
export async function getCategoryCounts(): Promise<CategoryCount[]> {
  const rows = await prisma.$queryRaw<{ slug: string; name: string; facilities: bigint }[]>`
    SELECT c."slug" AS slug, c."name" AS name, count(DISTINCT b."id")::bigint AS facilities
    FROM "Business" b
    JOIN "BusinessCategory" bc ON bc."businessId" = b."id"
      AND bc."reviewStatus" IN ('AUTO_APPROVED', 'APPROVED')
    JOIN "Category" c ON c."id" = bc."categoryId"
    WHERE b."isPublished" = true
      AND c."slug" IN (${Prisma.join(PUBLIC_CATEGORY_SLUGS)})
    GROUP BY c."slug", c."name"
    ORDER BY facilities DESC
  `;
  return rows.map((r) => ({ slug: r.slug, name: r.name, facilities: Number(r.facilities) }));
}

export interface StatePrice {
  code: string;
  name: string;
  slug: string;
  medianPrice: number;
  samples: number;
}

// Median advertised monthly boarding price per state, where owners/crawl set a
// price. The "horse boarding cost by state" study. Only states with a meaningful
// sample (>= 5 priced facilities) to keep the number honest.
export async function getBoardingPriceByState(minSamples = 5): Promise<StatePrice[]> {
  const rows = await prisma.$queryRaw<
    { code: string | null; name: string; slug: string; median: number; samples: bigint }[]
  >`
    SELECT st."code" AS code, st."name" AS name, st."slug" AS slug,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY b."priceFrom")::float AS median,
           count(*)::bigint AS samples
    FROM "Business" b
    JOIN "Location" city ON city."id" = b."locationId"
    JOIN "Location" co ON co."id" = city."parentId"
    JOIN "Location" st ON st."id" = co."parentId" AND st."type" = 'STATE'
    WHERE ${PUBLISHED_CATALOG} AND b."priceFrom" IS NOT NULL AND b."priceFrom" > 0
    GROUP BY st."id", st."code", st."name", st."slug"
    HAVING count(*) >= ${minSamples}
    ORDER BY median DESC
  `;
  return rows.map((r) => ({
    code: r.code ?? "",
    name: r.name,
    slug: r.slug,
    medianPrice: Math.round(r.median),
    samples: Number(r.samples),
  }));
}

export interface LocationStats {
  facilities: number;
  avgRating: number | null;
  reviews: number;
  priceFrom: number | null;
  spotsAvailable: number;
}

// Per-location stat strip (Lever 1B): unique real numbers for a city/county/state
// hub, so each programmatic page has content no template alone provides. Matches
// the city directly or any descendant under a county/state.
export async function getLocationStats(locationId: string): Promise<LocationStats> {
  const rows = await prisma.$queryRaw<
    {
      facilities: bigint;
      avg_rating: number | null;
      reviews: bigint;
      min_price: number | null;
      open_spots: bigint;
    }[]
  >`
    SELECT count(*)::bigint AS facilities,
           avg(b."rating")::float AS avg_rating,
           coalesce(sum(b."reviewCount"), 0)::bigint AS reviews,
           min(NULLIF(b."priceFrom", 0))::int AS min_price,
           coalesce(sum(GREATEST(b."spotsAvailable", 0)), 0)::bigint AS open_spots
    FROM "Business" b
    WHERE ${PUBLISHED_CATALOG}
      AND (
        b."locationId" = ${locationId}
        OR b."locationId" IN (SELECT "id" FROM "Location" WHERE "parentId" = ${locationId})
        OR b."locationId" IN (
          SELECT c."id" FROM "Location" c
          JOIN "Location" p ON c."parentId" = p."id"
          WHERE p."parentId" = ${locationId}
        )
      )
  `;
  const r = rows[0];
  return {
    facilities: Number(r?.facilities ?? 0),
    avgRating: r?.avg_rating != null ? Math.round(r.avg_rating * 100) / 100 : null,
    reviews: Number(r?.reviews ?? 0),
    priceFrom: r?.min_price ?? null,
    spotsAvailable: Number(r?.open_spots ?? 0),
  };
}
