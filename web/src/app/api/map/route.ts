import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_CATEGORY_WHERE, STABLES_SLUG } from "@/lib/db/business";

export const revalidate = 300;

// GET /api/map — lightweight GeoJSON of published stables for the map view.
export async function GET() {
  const rows = await prisma.business.findMany({
    // V1: stables/barns only (boarding facilities). Other crawled categories
    // (farrier/vet/tack/feed/trainer) stay in the DB, just hidden for now.
    where: {
      isPublished: true,
      categories: { some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: STABLES_SLUG } } },
    },
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
      location: { select: { name: true } },
      categories: {
        where: PUBLIC_CATEGORY_WHERE,
        select: { category: { select: { slug: true, name: true } } },
        orderBy: [{ isPrimary: "desc" }, { rank: "asc" }],
        take: 6,
      },
      images: { select: { url: true }, orderBy: { rank: "asc" }, take: 1 },
    },
    take: 2000,
  });

  const features = rows.map((b) => {
    const attrs = (b.attributes ?? {}) as { offering?: string; priceFrom?: number };
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
        image: b.images[0]?.url ?? null,
        featured: b.isFeatured,
        verified: b.verificationBadge !== "UNVERIFIED",
        // V1: every listing is a boarding facility -> "Stalls Available" by
        // default; owners can override the offering later (Camp/Lessons/…).
        offering: typeof attrs.offering === "string" ? attrs.offering : "Stalls Available",
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
