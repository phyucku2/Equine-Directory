import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { StableMarker } from "@/components/stable/StableCard";

// Consumer favorites (M5 / §3). Login is required (no guest path); each row is
// unique on (userId, businessId). DB logic lives here, mirroring claim.ts.

/**
 * Save a business for a user. Idempotent: a second save of the same business
 * is a no-op (returns `created: false`). Returns null if the business does not
 * exist (or is not a valid save target).
 */
export async function saveStable(
  userId: string,
  businessId: string,
): Promise<{ created: boolean } | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) return null;

  try {
    await prisma.savedStable.create({ data: { userId, businessId } });
    return { created: true };
  } catch (err) {
    // Unique-constraint violation -> already saved.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { created: false };
    }
    throw err;
  }
}

/** Remove a saved business. Idempotent: returns `removed: false` if not saved. */
export async function unsaveStable(
  userId: string,
  businessId: string,
): Promise<{ removed: boolean }> {
  const res = await prisma.savedStable.deleteMany({ where: { userId, businessId } });
  return { removed: res.count > 0 };
}

/** Just the saved business ids for a user (for the client-side heart merge). */
export async function listSavedStableIds(userId: string): Promise<string[]> {
  const rows = await prisma.savedStable.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { businessId: true },
  });
  return rows.map((r) => r.businessId);
}

/**
 * Full saved-stable cards for the /account/saved page, shaped to `StableMarker`
 * so they render through the shared `StableCard`. Orders by most-recently saved.
 */
export async function listSavedStables(userId: string): Promise<StableMarker[]> {
  const rows = await prisma.savedStable.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      business: {
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
          attributes: true,
          location: { select: { name: true } },
          images: { select: { url: true }, orderBy: { rank: "asc" }, take: 1 },
        },
      },
    },
  });

  return rows.map(({ business: b }) => {
    const attrs = (b.attributes ?? {}) as { offering?: string; priceFrom?: number };
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      city: b.location?.name ?? "",
      rating: b.rating != null ? Number(b.rating) : null,
      reviewCount: b.reviewCount,
      image: b.images[0]?.url ?? null,
      featured: b.isFeatured,
      verified: b.verificationBadge !== "UNVERIFIED",
      offering: typeof attrs.offering === "string" ? attrs.offering : "Stalls Available",
      priceFrom: typeof attrs.priceFrom === "number" ? attrs.priceFrom : null,
      amenities: b.amenities ?? [],
      lng: b.longitude,
      lat: b.latitude,
    };
  });
}

/** Count of saved stables for a user (dashboard summary). */
export function countSavedStables(userId: string): Promise<number> {
  return prisma.savedStable.count({ where: { userId } });
}
