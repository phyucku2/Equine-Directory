import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { PUBLIC_CATEGORY_SLUGS, isPublicCategorySlug } from "@/lib/catalog";

export { PUBLIC_CATEGORY_SLUGS, isPublicCategorySlug };

const PAGE_SIZE = 24;

// A category assignment is publicly visible when a human/system approved it
// (grade 3 auto-approves; grades 1–2 require moderation -> APPROVED).
export const PUBLIC_CATEGORY_WHERE: Prisma.BusinessCategoryWhereInput = {
  reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] },
};

// Public catalog scope: the six service verticals (boarding, training, vets,
// farriers, tack, feed) defined in src/lib/catalog.ts. Other crawled categories
// stay in the DB but are hidden until their data is verified. This is the single
// source of truth — every public business query and /api/map references it.
// Boarding remains the flagship vertical (brand, featured rails, reports).
export const STABLES_SLUG = "horse-boarding";

export function isStablesSlug(slug: string): boolean {
  return slug === STABLES_SLUG;
}

// A business is publicly listed if it has a published category in the catalog.
export const PUBLIC_CATEGORY_SOME: Prisma.BusinessCategoryListRelationFilter = {
  some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: { in: PUBLIC_CATEGORY_SLUGS } } },
};

// Boarding-only relation filter, kept for the stables-specific surfaces
// (featured barns, "stables near you", not-a-stable reports).
export const STABLES_CATEGORY_SOME: Prisma.BusinessCategoryListRelationFilter = {
  some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: STABLES_SLUG } },
};

// Names that signal a NON-barn attraction that occasionally gets a stray
// horse-boarding category during the crawl (e.g. "Goat Yoga At Alaska Farms" —
// 1,649 reviews — surfaced as a featured "stable"). These are agritourism /
// event venues, not boarding facilities. Kept tight + specific to clearly
// non-equine activities to avoid excluding legitimately-named barns. Mirrors the
// crawler's _is_nonbarn_text() intent (crawler/run.py) on the read side, so a
// record that slipped past ingestion still never shows publicly. See
// specs/post-launch-fixes.md §2.
export const NON_BARN_NAME_KEYWORDS = [
  "goat yoga",
  "petting zoo",
  "petting farm",
  "farm tour",
  "pumpkin patch",
  "corn maze",
  "wedding venue",
  "axe throwing",
  "go kart",
  "go-kart",
  "mini golf",
  "water park",
  "trampoline park",
  // Agritourism / farm-animal attractions that aren't boarding barns. Note this
  // is name-only — a generically-named farm (e.g. "Wildflower Farm") won't match;
  // those are handled by crowdsourced reports (see hasNoOpenReport below).
  "goat farm",
  "dairy",
  "creamery",
  "alpaca",
  "llama",
  "u-pick",
  "u pick",
  "sunflower field",
  "petting",
] as const;

// Top-level NOT with an array is a NOR: a business matches only when its name
// contains NONE of the non-barn keywords (case-insensitive).
export const NOT_NON_BARN_NAME: Prisma.BusinessWhereInput = {
  NOT: NON_BARN_NAME_KEYWORDS.map((kw) => ({
    name: { contains: kw, mode: "insensitive" as const },
  })),
};

export const STABLES_BUSINESS_WHERE: Prisma.BusinessWhereInput = {
  isPublished: true,
  categories: STABLES_CATEGORY_SOME,
  ...NOT_NON_BARN_NAME,
};

// Directory-wide public where: any published business carrying at least one
// approved catalog category. The non-barn name screen applies across the board —
// the keywords are agritourism/attraction signals that don't belong in any of
// the six verticals.
export const PUBLIC_BUSINESS_WHERE: Prisma.BusinessWhereInput = {
  isPublished: true,
  categories: PUBLIC_CATEGORY_SOME,
  ...NOT_NON_BARN_NAME,
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
  // Monetization relations the entitlements resolver needs (subscription tier +
  // active spotlights) so the public listing can gate logo / stalls badge /
  // review collection and surface trainers/events (monetization-tiers.md).
  subscription: true,
  spotlights: true,
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

// Card shape used in hub/search grids. Includes the subscription (so the card can
// resolve canLogo / stallsBadge via getEntitlements) and the logo image row.
export const businessCardInclude = {
  location: { include: { parent: true } },
  categories: {
    where: PUBLIC_CATEGORY_WHERE,
    include: { category: true },
    orderBy: [{ isPrimary: "desc" }, { rank: "asc" }],
    take: 3,
  },
  // Logo (rank -1) sorts first, then the primary photo — the card splits them.
  images: { orderBy: { rank: "asc" }, take: 2 },
  // Subscription so the card can resolve canLogo / stallsBadge via getEntitlements.
  subscription: true,
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
      categories: PUBLIC_CATEGORY_SOME,
      ...NOT_NON_BARN_NAME,
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

// Featured should showcase genuine, trustworthy barns — not just whatever has the
// most Google reviews (which let a goat-yoga venue lead the homepage). Prefer
// verified, then claimed (has a paying subscription), then hand-picked
// (isFeatured), then rating/reviews. The non-barn name exclusion already lives in
// STABLES_BUSINESS_WHERE. See specs/post-launch-fixes.md §2.
function featuredOrdering(): Prisma.BusinessOrderByWithRelationInput[] {
  return [
    { isVerified: "desc" },
    { isFeatured: "desc" },
    { rating: { sort: "desc", nulls: "last" } },
    { reviewCount: "desc" },
  ];
}

// Premium placement is held to a higher bar than the rest of the directory: a
// single open "not a stable" report drops a listing from Featured immediately
// (the directory-wide auto-hide still needs the full threshold). This makes the
// report button a one-tap fix for a mis-categorized farm headlining the homepage
// — generically-named non-barns can't be caught by name alone.
const HAS_NO_OPEN_REPORT: Prisma.BusinessWhereInput = {
  reports: { none: { status: "open" } },
};

export async function getFeatured(take = 6): Promise<BusinessCard[]> {
  return prisma.business.findMany({
    where: { ...STABLES_BUSINESS_WHERE, ...HAS_NO_OPEN_REPORT },
    include: businessCardInclude,
    orderBy: featuredOrdering(),
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
      categories: PUBLIC_CATEGORY_SOME,
      ...NOT_NON_BARN_NAME,
      OR: [
        { locationId },
        { location: { parentId: locationId } },
        { location: { parent: { parentId: locationId } } },
      ],
    },
  });
}
