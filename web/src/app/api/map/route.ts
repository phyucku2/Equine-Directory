import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_CATEGORY_WHERE, PUBLIC_CATEGORY_SLUGS, STABLES_SLUG, NOT_NON_BARN_NAME } from "@/lib/db/business";
import { getEntitlements } from "@/lib/entitlements";

// Reading request.nextUrl makes this handler dynamic; the CDN still caches each
// bbox URL via the Cache-Control header below (the client rounds bboxes to a
// coarse grid so pan-jitter reuses cached URLs).
export const dynamic = "force-dynamic";

// Business ids with an active Spotlight covering now (monetization-tiers.md). The
// map flags these so featured pins can be hoisted/styled. Capped per city is a
// display concern handled by the city/area blocks; here we surface the raw flag.
async function activeSpotlightBusinessIds(now: Date): Promise<Set<string>> {
  const rows = await prisma.spotlight.findMany({
    where: { status: "active", startsAt: { lte: now }, endsAt: { gte: now } },
    select: { businessId: true },
  });
  return new Set(rows.map((r) => r.businessId));
}

// Viewport bounding box, parsed from ?bbox=west,south,east,north. Invalid or
// absurd boxes fall back to the legacy no-bbox (national, capped) response.
function parseBbox(raw: string | null): { west: number; south: number; east: number; north: number } | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  // A box spanning most of the country is the national view — the legacy capped
  // query (quality-first) serves that better than a box scan.
  if (east - west > 40 || north - south > 25) return null;
  return { west, south, east, north };
}

// Per-request row caps. Viewport requests are dense but local; the no-bbox
// national fallback keeps the historical cap.
const BBOX_TAKE = 800;
const NATIONAL_TAKE = 2000;

// GET /api/map — lightweight GeoJSON of published catalog listings (boarding,
// training, vets, farriers, tack, feed) for the map view. The client filters by
// service segment via the categorySlugs feature property. Pass ?bbox=w,s,e,n to
// scope pins to the current viewport (Zillow-style refetch-on-pan).
export async function GET(request: NextRequest) {
  const now = new Date();
  const bbox = parseBbox(request.nextUrl.searchParams.get("bbox"));
  const spotlightIds = await activeSpotlightBusinessIds(now);
  const rows = await prisma.business.findMany({
    where: {
      isPublished: true,
      categories: {
        some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: { in: PUBLIC_CATEGORY_SLUGS } } },
      },
      ...NOT_NON_BARN_NAME,
      ...(bbox
        ? {
            latitude: { gte: bbox.south, lte: bbox.north },
            longitude: { gte: bbox.west, lte: bbox.east },
          }
        : {}),
    },
    // Quality-first ordering so the `take` cap truncates the tail, not at random.
    orderBy: [
      { isFeatured: "desc" },
      { rating: { sort: "desc", nulls: "last" } },
      { reviewCount: "desc" },
    ],
    select: {
      id: true,
      slug: true,
      name: true,
      latitude: true,
      longitude: true,
      rating: true,
      reviewCount: true,
      isFeatured: true,
      verificationBadge: true,
      amenities: true,
      // Filterable facet columns (owner-profile-facets.md §6) — exposed in the
      // GeoJSON feature properties so the search/map filter stage can filter
      // client-side without a round-trip. priceFrom prefers the owner-derived
      // column (min over pricing[].from) but falls back to attributes.priceFrom.
      disciplines: true,
      boardTypes: true,
      trainingTypes: true,
      securityFeatures: true,
      policies: true,
      programs: true,
      priceFrom: true,
      spotsAvailable: true,
      attributes: true,
      // Subscription tier so we can gate the stalls badge + logo (getEntitlements
      // flags). No spotlights here — spotlight membership comes from spotlightIds.
      subscription: { select: { tier: true, status: true, trainerSeats: true } },
      location: { select: { name: true } },
      categories: {
        // Catalog categories only — hidden assignments (event-venue, …) must not
        // leak into the categorySlugs the client filters on.
        where: { ...PUBLIC_CATEGORY_WHERE, category: { slug: { in: PUBLIC_CATEGORY_SLUGS } } },
        select: { category: { select: { slug: true, name: true } } },
        orderBy: [{ isPrimary: "desc" }, { rank: "asc" }],
        take: 6,
      },
      // Logo (rank -1) sorts first, then the primary photo — split below.
      images: { select: { url: true, isLogo: true }, orderBy: { rank: "asc" }, take: 2 },
    },
    take: bbox ? BBOX_TAKE : NATIONAL_TAKE,
  });

  const features = rows.map((b) => {
    const attrs = (b.attributes ?? {}) as {
      offering?: string;
      priceFrom?: number;
      stallsBadge?: boolean;
    };
    const ent = getEntitlements({ subscription: b.subscription });
    const logoUrl = ent.canLogo ? b.images.find((i) => i.isLogo)?.url ?? null : null;
    const photo = b.images.find((i) => !i.isLogo)?.url ?? null;
    const stallsBadge =
      ent.stallsBadge && attrs.stallsBadge === true && (b.spotsAvailable ?? 0) > 0;
    return {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [b.longitude, b.latitude] },
      properties: {
        id: b.id,
        slug: b.slug,
        name: b.name,
        city: b.location?.name ?? "",
        category: b.categories[0]?.category.name ?? "",
        categorySlugs: b.categories.map((c) => c.category.slug),
        rating: b.rating != null ? Number(b.rating) : null,
        reviewCount: b.reviewCount,
        image: photo,
        logo: logoUrl,
        // Owner-uploaded logo + "Stalls Available" badge (entitlement-gated).
        stallsBadge,
        // Featured = manual editorial flag OR an active paid Spotlight placement.
        featured: b.isFeatured || spotlightIds.has(b.id),
        spotlight: spotlightIds.has(b.id),
        verified: b.verificationBadge !== "UNVERIFIED",
        // Boarding listings default to "Stalls Available"; other verticals show
        // their category name. Owners can override the offering (Camp/Lessons/…).
        offering:
          typeof attrs.offering === "string"
            ? attrs.offering
            : b.categories.some((c) => c.category.slug === STABLES_SLUG)
              ? "Stalls Available"
              : b.categories[0]?.category.name ?? "Equine services",
        // Owner-derived priceFrom wins; legacy attributes.priceFrom is the fallback.
        priceFrom:
          b.priceFrom != null
            ? b.priceFrom
            : typeof attrs.priceFrom === "number"
              ? attrs.priceFrom
              : null,
        amenities: b.amenities ?? [],
        // Filterable facet arrays + live-openings count for the filters stage.
        disciplines: b.disciplines ?? [],
        boardTypes: b.boardTypes ?? [],
        trainingTypes: b.trainingTypes ?? [],
        securityFeatures: b.securityFeatures ?? [],
        policies: b.policies ?? [],
        // Distinct program types (programs[].type) for the "summer camp" filter.
        programTypes: Array.isArray(b.programs)
          ? [
              ...new Set(
                (b.programs as { type?: unknown }[])
                  .map((p) => (typeof p?.type === "string" ? p.type : null))
                  .filter((t): t is string => t !== null),
              ),
            ]
          : [],
        spotsAvailable: b.spotsAvailable ?? null,
      },
    };
  });

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
