import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  businessCardInclude,
  PUBLIC_CATEGORY_SOME,
  PUBLIC_CATEGORY_SLUGS,
  NOT_NON_BARN_NAME,
  NON_BARN_NAME_KEYWORDS,
  type BusinessCard,
  type Paginated,
} from "@/lib/db/business";

// Free-text search spans the whole public catalog. Constrain the raw FTS to
// businesses that carry a published catalog category (mirrors PUBLIC_BUSINESS_WHERE).
const PUBLIC_EXISTS = Prisma.sql`
  AND EXISTS (
    SELECT 1 FROM "BusinessCategory" bc
    JOIN "Category" c ON c."id" = bc."categoryId"
    WHERE bc."businessId" = "Business"."id"
      AND bc."reviewStatus" IN ('AUTO_APPROVED', 'APPROVED')
      AND c."slug" IN (${Prisma.join(PUBLIC_CATEGORY_SLUGS)})
  )`;

export interface SearchParams {
  q?: string;
  categorySlug?: string;
  citySlug?: string;
  countySlug?: string;
  minRating?: number;
  verifiedOnly?: boolean;
  page?: number;
  // Zillow-style facet filters (owner-profile-facets.md §6). All array facets
  // use Postgres array containment (hasSome) on the GIN-indexed columns; the
  // caller is expected to pass already-validated slugs (sanitizeFacet).
  disciplines?: string[];
  boardTypes?: string[];
  trainingTypes?: string[];
  securityFeatures?: string[];
  policies?: string[];
  amenities?: string[];
  // programs[].type values (e.g. "summer-camp"). Matched against the `programs`
  // JSON column via array_contains on a partial { type } object.
  programTypes?: string[];
  priceMax?: number; // priceFrom <= priceMax
  availableNow?: boolean; // spotsAvailable > 0
}

const PAGE_SIZE = 24;

// Ranked full-text search over name + description using the GIN index, with a
// trigram similarity fallback for fuzzy/typo queries. Returns ordered ids.
async function rankedIds(q: string, limit: number, offset: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "Business"
    WHERE "isPublished" = true
      AND (
        to_tsvector('english', "name" || ' ' || coalesce("description", '')) @@ plainto_tsquery('english', ${q})
        OR "name" % ${q}
      )
      ${PUBLIC_EXISTS}
    ORDER BY
      "isFeatured" DESC,
      ts_rank(to_tsvector('english', "name" || ' ' || coalesce("description", '')), plainto_tsquery('english', ${q})) DESC,
      similarity("name", ${q}) DESC,
      "reviewCount" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((r) => r.id);
}

async function countFts(q: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM "Business"
    WHERE "isPublished" = true
      AND (
        to_tsvector('english', "name" || ' ' || coalesce("description", '')) @@ plainto_tsquery('english', ${q})
        OR "name" % ${q}
      )
      ${PUBLIC_EXISTS}
  `;
  return Number(rows[0]?.count ?? 0);
}

// Structured filter (no free-text): used for faceted browsing.
function buildWhere(p: SearchParams): Prisma.BusinessWhereInput {
  const where: Prisma.BusinessWhereInput = { isPublished: true };
  const and: Prisma.BusinessWhereInput[] = [];

  // Every result must carry at least one public catalog category.
  and.push({ categories: PUBLIC_CATEGORY_SOME });
  // Exclude non-barn attractions (goat yoga / petting zoo / …) by name — same
  // chokepoint as PUBLIC_BUSINESS_WHERE (post-launch-fixes.md §2).
  and.push(NOT_NON_BARN_NAME);

  if (p.categorySlug) {
    and.push({
      categories: {
        some: {
          reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] },
          category: { slug: p.categorySlug },
        },
      },
    });
  }
  if (p.citySlug) and.push({ location: { slug: p.citySlug, type: "CITY" } });
  else if (p.countySlug)
    and.push({ location: { parent: { slug: p.countySlug, type: "COUNTY" } } });
  if (p.minRating) and.push({ rating: { gte: new Prisma.Decimal(p.minRating) } });
  if (p.verifiedOnly) and.push({ isVerified: true });

  // Array-containment facets on the GIN-indexed String[] columns. `hasSome`
  // means "matches any selected slug" (OR within a facet); separate facets AND
  // together — standard Zillow-style behavior.
  if (p.disciplines?.length) and.push({ disciplines: { hasSome: p.disciplines } });
  if (p.boardTypes?.length) and.push({ boardTypes: { hasSome: p.boardTypes } });
  if (p.trainingTypes?.length) and.push({ trainingTypes: { hasSome: p.trainingTypes } });
  if (p.securityFeatures?.length) and.push({ securityFeatures: { hasSome: p.securityFeatures } });
  if (p.policies?.length) and.push({ policies: { hasSome: p.policies } });
  if (p.amenities?.length) and.push({ amenities: { hasSome: p.amenities } });

  // Numeric range / availability facets.
  if (p.priceMax != null) and.push({ priceFrom: { lte: p.priceMax } });
  if (p.availableNow) and.push({ spotsAvailable: { gt: 0 } });

  // Program types live in the `programs` JSON column ([{ type, ... }]). Match
  // rows whose array contains an entry with the selected type (OR across types).
  if (p.programTypes?.length) {
    and.push({
      OR: p.programTypes.map((type) => ({
        programs: { array_contains: [{ type }] },
      })),
    });
  }

  if (and.length) where.AND = and;
  return where;
}

export interface FacetCount {
  slug: string;
  name: string;
  count: number;
}

// Category facet counts for the current location/verified filter (ignores the
// active category so users can switch categories and still see counts).
export async function getCategoryFacets(p: SearchParams): Promise<FacetCount[]> {
  const base = buildWhere({ ...p, categorySlug: undefined });
  const rows = await prisma.businessCategory.groupBy({
    by: ["categoryId"],
    where: {
      reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] },
      // Only count catalog categories — a public business may also carry hidden
      // category assignments (e.g. event-venue) that must not surface as facets.
      category: { slug: { in: PUBLIC_CATEGORY_SLUGS } },
      business: base,
    },
    _count: { businessId: true },
  });
  if (rows.length === 0) return [];
  const cats = await prisma.category.findMany({
    where: { id: { in: rows.map((r) => r.categoryId) } },
    select: { id: true, slug: true, name: true },
  });
  const byId = new Map(cats.map((c) => [c.id, c]));
  return rows
    .map((r) => {
      const c = byId.get(r.categoryId);
      return c ? { slug: c.slug, name: c.name, count: r._count.businessId } : null;
    })
    .filter((x): x is FacetCount => x !== null)
    .sort((a, b) => b.count - a.count);
}

export async function searchBusinesses(p: SearchParams): Promise<Paginated<BusinessCard>> {
  const page = Math.max(1, p.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;
  const q = p.q?.trim();

  let items: BusinessCard[];
  let total: number;

  if (q) {
    // Free-text path: rank by FTS, then apply structured filters in-memory-safe
    // by re-querying the ranked ids constrained to the filter where-clause.
    const where = buildWhere(p);
    const ids = await rankedIds(q, PAGE_SIZE, offset);
    if (ids.length === 0) {
      total = await countFts(q);
      return { items: [], total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
    }
    const found = await prisma.business.findMany({
      where: { ...where, id: { in: ids } },
      include: businessCardInclude,
    });
    const order = new Map(ids.map((id, i) => [id, i]));
    items = found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    total = await countFts(q);
  } else {
    const where = buildWhere(p);
    const [found, count] = await Promise.all([
      prisma.business.findMany({
        where,
        include: businessCardInclude,
        orderBy: [{ isFeatured: "desc" }, { rating: { sort: "desc", nulls: "last" } }, { reviewCount: "desc" }],
        skip: offset,
        take: PAGE_SIZE,
      }),
      prisma.business.count({ where }),
    ]);
    items = found;
    total = count;
  }

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// Same honesty cap as the homepage "near you" rails (src/lib/db/nearby.ts):
// a visitor in one metro shouldn't be shown a barn 300 miles away just because
// it's the nearest match.
const GEO_MAX_KM = 250;

// Proximity search for the "near me" intent (see src/lib/geo-intent.ts). Orders
// the public catalog by great-circle distance from the visitor, optionally
// narrowed to a set of category slugs (resolved from the query, e.g. "farrier
// near me" → ["farrier"]) and/or a residual keyword. Mirrors getNearbyStables'
// haversine SQL but spans the whole catalog rather than boarding only.
export async function geoSearchBusinesses(
  lat: number,
  lng: number,
  opts: { categorySlugs?: string[]; q?: string; take?: number } = {},
): Promise<BusinessCard[]> {
  const take = opts.take ?? 48;
  const patterns = NON_BARN_NAME_KEYWORDS.map((kw) => `%${kw}%`);
  const slugs = opts.categorySlugs?.length ? opts.categorySlugs : PUBLIC_CATEGORY_SLUGS;
  const keyword = opts.q?.trim();
  const keywordSql = keyword
    ? Prisma.sql`AND (
        to_tsvector('english', b."name" || ' ' || coalesce(b."description", '')) @@ plainto_tsquery('english', ${keyword})
        OR b."name" % ${keyword}
      )`
    : Prisma.empty;

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
      AND b."name" NOT ILIKE ALL(${patterns}::text[])
      AND EXISTS (
        SELECT 1 FROM "BusinessCategory" bc
        JOIN "Category" c ON c."id" = bc."categoryId"
        WHERE bc."businessId" = b."id"
          AND bc."reviewStatus" IN ('AUTO_APPROVED','APPROVED')
          AND c."slug" IN (${Prisma.join(slugs)})
      )
      ${keywordSql}
    ORDER BY distance_km ASC
    LIMIT ${take}
  `;

  const near = rows.filter((r) => r.distance_km <= GEO_MAX_KM);
  if (near.length === 0) return [];
  const order = new Map(near.map((r, i) => [r.id, i]));
  const cards = await prisma.business.findMany({
    where: { id: { in: near.map((r) => r.id) } },
    include: businessCardInclude,
  });
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
