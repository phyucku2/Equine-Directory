import { auth } from "@/auth";
import type { OwnerBusiness } from "@/lib/db/owner";
import { getOwnedBusinessBySlug, loadBusinessForEntitlements } from "@/lib/db/owner";
import { getEntitlements, type Entitlements } from "@/lib/entitlements";
import type { StableMarker } from "@/components/stable/StableCard";

// Load an owned business at a page boundary. Returns null when the slug doesn't
// exist OR the signed-in user doesn't own it (ADMIN bypasses) — the page calls
// notFound() in either case so existence never leaks. The owner/layout already
// redirected unauthenticated users, so a missing session here just yields null.
export async function loadOwnedBusiness(slug: string): Promise<OwnerBusiness | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const isAdmin = session.user.role === "ADMIN";
  return getOwnedBusinessBySlug(userId, slug, isAdmin);
}

// Load an owned business AND resolve its entitlements (subscription + spotlights)
// in one place, for tabs that gate on tier (Plan/Trainers/Events/Photos). Returns
// null when the slug isn't owned (the page calls notFound()).
export async function loadOwnedBusinessWithEntitlements(
  slug: string,
): Promise<{ business: OwnerBusiness; entitlements: Entitlements } | null> {
  const business = await loadOwnedBusiness(slug);
  if (!business) return null;
  const withRels = await loadBusinessForEntitlements(business.id);
  const entitlements = getEntitlements(withRels ?? {});
  return { business, entitlements };
}

// Build the StableMarker the public StableCard renders, from the owner's
// (possibly unsaved) editable values. Used by the live preview on every screen.
export function toStableMarker(
  business: OwnerBusiness,
  overrides?: Partial<Pick<StableMarker, "offering" | "priceFrom" | "amenities" | "image">>,
): StableMarker {
  const attrs = (business.attributes ?? {}) as { offering?: string; priceFrom?: number };
  return {
    slug: business.slug,
    name: business.name,
    city: "",
    rating: business.rating != null ? Number(business.rating) : null,
    reviewCount: business.reviewCount,
    image: business.images[0]?.url ?? null,
    featured: business.isFeatured,
    verified: business.verificationBadge !== "UNVERIFIED",
    offering: typeof attrs.offering === "string" ? attrs.offering : "Stalls Available",
    priceFrom: typeof attrs.priceFrom === "number" ? attrs.priceFrom : null,
    amenities: business.amenities ?? [],
    lng: business.longitude,
    lat: business.latitude,
    ...overrides,
  };
}
