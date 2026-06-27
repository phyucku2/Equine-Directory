import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Owner-dashboard data layer. Mirrors the shape/style of claim.ts: thin,
// transaction-aware helpers the owner API routes and screens call. Every helper
// here assumes authorization was already enforced upstream by
// requireBusinessOwner(businessId) (businessId always from the URL). These
// helpers never look at the session — they only touch the DB.

// The four card-driving offering values. Shared so the API validator, the map
// default, and the listing segmented control can't drift. "Stalls Available" is
// the map default (see /api/map).
export const OFFERINGS = ["Stalls Available", "Summer Camp", "Lessons", "Training"] as const;
export type Offering = (typeof OFFERINGS)[number];

export function isOffering(v: unknown): v is Offering {
  return typeof v === "string" && (OFFERINGS as readonly string[]).includes(v);
}

// Billing / server-owned attribute keys an owner must never be able to write
// through an attribute-merge route. `addons` is §5 billing state that grants
// entitlements; `googleMapsUri` is crawled and preserved, not owner-editable.
const PROTECTED_ATTRIBUTE_KEYS = ["addons", "billing", "subscription", "entitlements"] as const;

// Strip billing/server-owned keys from a client-supplied (or merged) attribute
// blob. Used inside attribute-merge writes so an owner can't escalate.
export function stripProtectedAttributeKeys(
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...attrs };
  for (const k of PROTECTED_ATTRIBUTE_KEYS) delete out[k];
  return out;
}

function asRecord(json: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return json && typeof json === "object" && !Array.isArray(json)
    ? (json as Record<string, unknown>)
    : {};
}

// --- Dashboard home: list businesses an owner manages, with a response backlog
// count (approved reviews still missing an owner reply + unread inquiries). ---

export interface OwnerBusinessSummary {
  id: string;
  name: string;
  slug: string;
  reviewCount: number;
  rating: number | null;
  responseRate: number | null;
  verificationBadge: string;
  isFeatured: boolean;
  /** approved reviews with no ownerResponse yet */
  pendingReviewCount: number;
  /** inquiries in NEW status */
  newInquiryCount: number;
  coverImage: string | null;
}

export async function listOwnedBusinesses(userId: string): Promise<OwnerBusinessSummary[]> {
  const businesses = await prisma.business.findMany({
    where: { owners: { some: { userId } } },
    select: {
      id: true,
      name: true,
      slug: true,
      reviewCount: true,
      rating: true,
      responseRate: true,
      verificationBadge: true,
      isFeatured: true,
      images: { select: { url: true }, orderBy: [{ source: "asc" }, { rank: "asc" }], take: 1 },
      _count: {
        select: {
          reviews: { where: { isApproved: true, ownerResponse: null } },
          inquiries: { where: { status: "NEW" } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return businesses.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    reviewCount: b.reviewCount,
    rating: b.rating != null ? Number(b.rating) : null,
    responseRate: b.responseRate != null ? Number(b.responseRate) : null,
    verificationBadge: b.verificationBadge,
    isFeatured: b.isFeatured,
    pendingReviewCount: b._count.reviews,
    newInquiryCount: b._count.inquiries,
    coverImage: b.images[0]?.url ?? null,
  }));
}

// --- Single owned business (by slug) for the dashboard screens. Returns null
// if the slug doesn't exist OR the user doesn't own it (so the page calls
// notFound() either way without leaking existence). ---

export const ownerBusinessInclude = {
  images: { orderBy: [{ source: "asc" }, { rank: "asc" }] },
  reviews: { orderBy: { createdAt: "desc" } },
  inquiries: { orderBy: { createdAt: "desc" } },
  owners: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
} satisfies Prisma.BusinessInclude;

export type OwnerBusiness = Prisma.BusinessGetPayload<{
  include: typeof ownerBusinessInclude;
}>;

export async function getOwnedBusinessBySlug(
  userId: string,
  slug: string,
  isAdmin = false,
): Promise<OwnerBusiness | null> {
  const business = await prisma.business.findFirst({
    where: isAdmin ? { slug } : { slug, owners: { some: { userId } } },
    include: ownerBusinessInclude,
  });
  return business;
}

// --- Details (name/contact/address/social). ---

export interface DetailsInput {
  name?: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string;
  socialLinks?: Prisma.InputJsonValue | null;
}

export function updateBusinessDetails(businessId: string, data: DetailsInput) {
  return prisma.business.update({
    where: { id: businessId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.website !== undefined ? { website: data.website } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.socialLinks !== undefined
        ? { socialLinks: data.socialLinks ?? Prisma.DbNull }
        : {}),
    },
    select: { id: true, slug: true },
  });
}

// --- Offering + priceFrom: the attribute-merge write. The DB attributes are
// re-read INSIDE the transaction and merged server-side so a stale or malicious
// client blob can never overwrite googleMapsUri or inject billing `addons`. ---

export async function updateOffering(
  businessId: string,
  offering: Offering,
  priceFrom: number | null,
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { attributes: true },
    });
    // Re-read from DB, merge server-side, strip billing keys. googleMapsUri (and
    // any other crawled attribute) survives because we spread the DB copy first.
    const merged = stripProtectedAttributeKeys({
      ...asRecord(current.attributes),
      offering,
      ...(priceFrom != null ? { priceFrom } : {}),
    });
    if (priceFrom == null) delete merged.priceFrom;

    return tx.business.update({
      where: { id: businessId },
      data: { attributes: merged as Prisma.InputJsonValue },
      select: { id: true, slug: true, attributes: true },
    });
  });
}

// --- Amenities: full replace of the String[] column. ---

export function replaceAmenities(businessId: string, amenities: string[]) {
  return prisma.business.update({
    where: { id: businessId },
    data: { amenities },
    select: { id: true, amenities: true },
  });
}

// --- Hours of operation: a Json blob in the { weekdayDescriptions: string[] }
// shape the public detail page reads. ---

export function replaceHours(businessId: string, hours: Prisma.InputJsonValue | null) {
  return prisma.business.update({
    where: { id: businessId },
    data: { hoursOfOperation: hours ?? Prisma.DbNull },
    select: { id: true, hoursOfOperation: true },
  });
}

// --- Images (BusinessImage source:OWNER). ---

export function createOwnerImage(
  businessId: string,
  data: { url: string; altText?: string | null; caption?: string | null; width?: number | null; height?: number | null },
) {
  return prisma.$transaction(async (tx) => {
    const max = await tx.businessImage.aggregate({
      where: { businessId },
      _max: { rank: true },
    });
    const nextRank = (max._max.rank ?? -1) + 1;
    return tx.businessImage.create({
      data: {
        businessId,
        url: data.url,
        altText: data.altText ?? null,
        caption: data.caption ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        rank: nextRank,
        source: "OWNER",
      },
    });
  });
}

// Count OWNER images for the entitlement (maxPhotos) gate.
export function countOwnerImages(businessId: string) {
  return prisma.businessImage.count({ where: { businessId, source: "OWNER" } });
}

// Delete an OWNER image (never a crawled/google row — those are not owner-owned).
export async function deleteOwnerImage(businessId: string, imageId: string) {
  const img = await prisma.businessImage.findFirst({
    where: { id: imageId, businessId, source: "OWNER" },
    select: { id: true, url: true },
  });
  if (!img) return null;
  await prisma.businessImage.delete({ where: { id: img.id } });
  return img;
}

// Reorder OWNER images: client sends the desired id order; we write rank by index.
export async function reorderOwnerImages(businessId: string, orderedIds: string[]) {
  const owned = await prisma.businessImage.findMany({
    where: { id: { in: orderedIds }, businessId, source: "OWNER" },
    select: { id: true },
  });
  const ownedSet = new Set(owned.map((i) => i.id));
  const ids = orderedIds.filter((id) => ownedSet.has(id));
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.businessImage.update({ where: { id }, data: { rank: i } }),
    ),
  );
  return ids.length;
}

// --- Review response + responseRate recompute, in one transaction. ---
// responseRate = respondedReviewCount / totalReviewCount * 100, stored in the
// Decimal(5,2) responseRate column. Numerator = reviews with non-null
// ownerResponse; denominator = total reviews for the business.

export async function respondToReview(
  businessId: string,
  reviewId: string,
  response: string,
) {
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.findFirst({
      where: { id: reviewId, businessId },
      select: { id: true },
    });
    if (!review) return null;

    await tx.review.update({
      where: { id: review.id },
      data: { ownerResponse: response, ownerRespondedAt: new Date() },
    });

    const [total, responded] = await Promise.all([
      tx.review.count({ where: { businessId } }),
      tx.review.count({ where: { businessId, ownerResponse: { not: null } } }),
    ]);
    const responseRate = total > 0 ? (responded / total) * 100 : 0;

    await tx.business.update({
      where: { id: businessId },
      data: { responseRate },
    });

    return { reviewId: review.id, responseRate, total, responded };
  });
}

// --- Inquiry inbox: flip status (mark read / replied / archived). ---

export async function setInquiryStatus(
  businessId: string,
  inquiryId: string,
  status: "NEW" | "READ" | "REPLIED" | "ARCHIVED",
) {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, businessId },
    select: { id: true },
  });
  if (!inquiry) return null;
  return prisma.inquiry.update({
    where: { id: inquiry.id },
    data: { status },
    select: { id: true, status: true },
  });
}
