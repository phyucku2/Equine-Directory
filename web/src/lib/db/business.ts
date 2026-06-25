import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 24;

// A category assignment is publicly visible when a human/system approved it
// (grade 3 auto-approves; grades 1–2 require moderation -> APPROVED).
export const PUBLIC_CATEGORY_WHERE: Prisma.BusinessCategoryWhereInput = {
  reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] },
};

// Full listing shape used by the detail page.
export const businessDetailInclude = {
  location: { include: { parent: { include: { parent: true } } } },
  categories: {
    where: PUBLIC_CATEGORY_WHERE,
    include: { category: true },
    orderBy: [{ isPrimary: "desc" }, { rank: "asc" }],
  },
  images: { orderBy: { rank: "asc" } },
  reviews: { where: { isApproved: true }, orderBy: { createdAt: "desc" } },
} satisfies Prisma.BusinessInclude;

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
  return prisma.business.findFirst({
    where: { slug, isPublished: true },
    include: businessDetailInclude,
  });
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
    where: { isPublished: true },
    include: businessCardInclude,
    orderBy: ordering(),
    take,
  });
}
