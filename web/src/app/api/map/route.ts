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
      slug: true,
      name: true,
      latitude: true,
      longitude: true,
      rating: true,
      reviewCount: true,
      isFeatured: true,
      verificationBadge: true,
      amenities: true,
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
        priceFrom: typeof attrs.priceFrom === "number" ? attrs.priceFrom : null,
        amenities: b.amenities ?? [],
      },
    };
  });

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
