import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 24;

// A category assignment is publicly visible when a human/system approved it
// (grade 3 auto-approves; grades 1–2 require moderation -> APPROVED).
export const PUBLIC_CATEGORY_WHERE: Prisma.BusinessCategoryWhereInput = {
  reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] },
};

// V1 scope: the public directory shows stables/barns (boarding facilities) ONLY.
// Other crawled categories (vets, farriers, trainers, tack, feed…) stay in the DB
// but are hidden until we launch their directories. This is the single source of
// truth — every public business query and /api/map references it.
export const STABLES_SLUG = "horse-boarding";

export function isStablesSlug(slug: string): boolean {
  return slug === STABLES_SLUG;
}

// A business is publicly listed only if it has a published boarding category.
export const STABLES_CATEGORY_SOME: Prisma.BusinessCategoryListRelationFilter = {
  some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: STABLES_SLUG } },
};

export const STABLES_BUSINESS_WHERE: Prisma.BusinessWhereInput = {
  isPublished: true,
  categories: STABLES_CATEGORY_SOME,
};

// Full listing shape used by the detail page. This is a Prisma `include`, so all
// scalar Business columns are returned automatically — including the structured
// facet columns added in owner-profile-facets.md: disciplines, boardTypes,
// trainingTypes, trainingDisciplines, lessonLevels, securityFeatures, policies,
// priceFrom, spotsAvailable, stallCount, acreage, pricing, programs, careDetails.
// (No `select` here, so we don't need to enumerate them; BusinessDetail exposes
// them and the public detail page renders grouped facet sections from them.)
export const businessDetailInclude = {
  location: { include: { parent: { include: { parent: true } } } },
  categories: {
    where: PUBLIC_CATEGORY_WHERE,
    include: { category: true },
    orderBy: [{ isPrimary: "desc" }, { rank: "asc" }],
  },
  // Source-priority ordering: OWNER photos must sort ahead of GOOGLE/CRAWLER on
  // the detail page (an owner upload overrides crawled photos without deleting
  // them). The ImageSource enum is declared CRAWLER, OWNER, GOOGLE, so a plain
  // `source: "asc"` does NOT put OWNER first — we order by source+rank here for a
  // stable result, then hoist OWNER in code (see sortImagesBySource).
  images: { orderBy: [{ source: "asc" }, { rank: "asc" }] },
  reviews: { where: { isApproved: true }, orderBy: { createdAt: "desc" } },
} satisfies Prisma.BusinessInclude;

// OWNER first, then GOOGLE, then CRAWLER — within each source, preserve rank.
const IMAGE_SOURCE_PRIORITY: Record<string, number> = { OWNER: 0, GOOGLE: 1, CRAWLER: 2 };

function sortImagesBySource<T extends { source: string; rank: number }>(images: T[]): T[] {
  return [...images].sort(
    (a, b) =>
      (IMAGE_SOURCE_PRIORITY[a.source] ?? 99) - (IMAGE_SOURCE_PRIORITY[b.source] ?? 99) ||
      a.rank - b.rank,
  );
}

export type BusinessDetail = Prisma.BusinessGetPayload<{
  include: typeof businessDetailInclude;
}>;

// Card shape used in hub/search grids.
export const businessCardInclude = {
  location: { include: { parent: true } },
  categories: {
    where: PUBLIC_CATEGORY_WHERE,
    include: { category: true },
    orderBy: [{ isPrimary: "desc" }, { rank: "asc" }],
    take: 3,
  },
  images: { orderBy: { rank: "asc" }, take: 1 },
} satisfies Prisma.BusinessInclude;

export type BusinessCard = Prisma.BusinessGetPayload<{
  include: typeof businessCardInclude;
}>;

export async function getBusinessBySlug(slug: string): Promise<BusinessDetail | null> {
  const business = await prisma.business.findFirst({
    where: { slug, isPublished: true },
    include: businessDetailInclude,
  });
  if (business) business.images = sortImagesBySource(business.images);
  return business;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function ordering(): Prisma.BusinessOrderByWithRelationInput[] {
  // Featured first, then by rating (nulls last), then review count.
  return [{ isFeatured: "desc" }, { rating: { sort: "desc", nulls: "last" } }, { reviewCount: "desc" }];
}

async function paginateBusinesses(
  where: Prisma.BusinessWhereInput,
  page: number,
): Promise<Paginated<BusinessCard>> {
  const safePage = Math.max(1, page);
  const [items, total] = await Promise.all([
    prisma.business.findMany({
      where,
      include: businessCardInclude,
      orderBy: ordering(),
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.business.count({ where }),
  ]);
  return {
    items,
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export function getByCategory(categorySlug: string, page = 1) {
  return paginateBusinesses(
    {
      isPublished: true,
      categories: { some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: categorySlug } } },
    },
    page,
  );
}

export function getByLocation(locationId: string, page = 1) {
  // Match the city directly or any descendant city under a county/state.
  return paginateBusinesses(
    {
      isPublished: true,
      categories: STABLES_CATEGORY_SOME,
      OR: [
        { locationId },
        { location: { parentId: locationId } },
        { location: { parent: { parentId: locationId } } },
      ],
    },
    page,
  );
}

export function getByCategoryAndLocation(categorySlug: string, locationId: string, page = 1) {
  return paginateBusinesses(
    {
      isPublished: true,
      categories: { some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: categorySlug } } },
      OR: [
        { locationId },
        { location: { parentId: locationId } },
        { location: { parent: { parentId: locationId } } },
      ],
    },
    page,
  );
}

// Related businesses: same primary category, near the same city, excluding self.
export async function getRelated(business: BusinessDetail, take = 4): Promise<BusinessCard[]> {
  const primaryCat = business.categories[0]?.category.slug;
  if (!primaryCat) return [];
  return prisma.business.findMany({
    where: {
      isPublished: true,
      id: { not: business.id },
      categories: { some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: primaryCat } } },
      locationId: business.locationId,
    },
    include: businessCardInclude,
    orderBy: ordering(),
    take,
  });
}

export async function getFeatured(take = 6): Promise<BusinessCard[]> {
  return prisma.business.findMany({
    where: STABLES_BUSINESS_WHERE,
    include: businessCardInclude,
    orderBy: ordering(),
    take,
  });
}

export function countByCategory(categorySlug: string): Promise<number> {
  return prisma.business.count({
    where: {
      isPublished: true,
      categories: { some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: categorySlug } } },
    },
  });
}

export function countByLocation(locationId: string): Promise<number> {
  return prisma.business.count({
    where: {
      isPublished: true,
      categories: STABLES_CATEGORY_SOME,
      OR: [
        { locationId },
        { location: { parentId: locationId } },
        { location: { parent: { parentId: locationId } } },
      ],
    },
  });
}
