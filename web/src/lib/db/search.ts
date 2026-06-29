import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  businessCardInclude,
  STABLES_CATEGORY_SOME,
  STABLES_SLUG,
  type BusinessCard,
  type Paginated,
} from "@/lib/db/business";

// V1: free-text search is stables-only too. Constrain the raw FTS to businesses
// that carry a published boarding category (mirrors STABLES_BUSINESS_WHERE).
const STABLES_EXISTS = Prisma.sql`
  AND EXISTS (
    SELECT 1 FROM "BusinessCategory" bc
    JOIN "Category" c ON c."id" = bc."categoryId"
    WHERE bc."businessId" = "Business"."id"
      AND bc."reviewStatus" IN ('AUTO_APPROVED', 'APPROVED')
      AND c."slug" = ${STABLES_SLUG}
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
      ${STABLES_EXISTS}
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
      ${STABLES_EXISTS}
  `;
  return Number(rows[0]?.count ?? 0);
}

// Structured filter (no free-text): used for faceted browsing.
function buildWhere(p: SearchParams): Prisma.BusinessWhereInput {
  const where: Prisma.BusinessWhereInput = { isPublished: true };
  const and: Prisma.BusinessWhereInput[] = [];

  // V1: every result must be a stable/barn (boarding facility).
  and.push({ categories: STABLES_CATEGORY_SOME });

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
