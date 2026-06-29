import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sanitizeFacet, PROGRAM_TYPE_SLUGS } from "@/lib/facets";

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
      images: {
        where: { isLogo: false },
        select: { url: true },
        orderBy: [{ source: "asc" }, { rank: "asc" }],
        take: 1,
      },
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

// --- Structured facets (owner-profile-facets.md §4). The four owner tabs write
// here. Every String[] facet is validated against the controlled vocab in
// facets.ts via sanitizeFacet(); the touched facet keys are appended to the
// ownerEditedFacets provenance array (dedup) so the crawler never overwrites an
// owner-supplied value. pricing/programs are validated JSON blobs. ---

// Append touched facet keys to ownerEditedFacets without dropping existing ones.
// We can't read-modify-write atomically in a single update without a transaction,
// so callers pass through a transaction (tx) or we use a nested write. To keep it
// simple and consistent with the rest of this file, the array writes below run in
// a $transaction that re-reads ownerEditedFacets and merges server-side.
function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

// Re-read ownerEditedFacets inside a tx and return the merged, de-duplicated set.
async function mergedEditedFacets(
  tx: Prisma.TransactionClient,
  businessId: string,
  touched: string[],
): Promise<string[]> {
  const current = await tx.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { ownerEditedFacets: true },
  });
  return dedupe([...current.ownerEditedFacets, ...touched]);
}

// Boarding & Pricing tab: boardTypes + numerics + pricing JSON + access policy.
export interface BoardingInput {
  boardTypes: string[];
  spotsAvailable: number | null;
  stallCount: number | null;
  acreage: number | null;
  /** raw per-board-type pricing map; validated by sanitizePricing server-side */
  pricing: unknown;
  /** access policy slugs from POLICIES (e.g. 24-7-access, daylight-access-only) */
  policies: string[];
}

export async function updateBoarding(businessId: string, input: BoardingInput) {
  const boardTypes = sanitizeFacet("boardTypes", input.boardTypes);
  // This tab owns only the access-policy slugs of `policies`; the trainer
  // (Disciplines) and facility (Facility) slugs are preserved server-side.
  const accessPolicies = sanitizeFacet("policies", input.policies).filter((p) =>
    ACCESS_POLICY_SLUGS.has(p),
  );
  const pricing = sanitizePricing(input.pricing, boardTypes);
  // priceFrom is derived = min over pricing[].from (kept for fast sort/filter).
  const priceFrom = derivePriceFrom(pricing);

  return prisma.$transaction(async (tx) => {
    const current = await tx.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { policies: true },
    });
    const otherPolicies = current.policies.filter((p) => !ACCESS_POLICY_SLUGS.has(p));
    const mergedPolicies = dedupe([...otherPolicies, ...accessPolicies]);

    const ownerEditedFacets = await mergedEditedFacets(tx, businessId, [
      "boardTypes",
      "policies",
      "pricing",
    ]);
    return tx.business.update({
      where: { id: businessId },
      data: {
        boardTypes,
        policies: mergedPolicies,
        spotsAvailable: input.spotsAvailable,
        stallCount: input.stallCount,
        acreage: input.acreage,
        priceFrom,
        pricing:
          Object.keys(pricing).length > 0
            ? (pricing as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
        ownerEditedFacets,
      },
      select: {
        id: true,
        boardTypes: true,
        policies: true,
        spotsAvailable: true,
        stallCount: true,
        acreage: true,
        priceFrom: true,
        pricing: true,
        ownerEditedFacets: true,
      },
    });
  });
}

// Disciplines & Training tab: disciplines accepted, trainingTypes,
// trainingDisciplines, lessonLevels, trainer (open/closed-barn) policy.
export interface DisciplinesInput {
  disciplines: string[];
  trainingTypes: string[];
  trainingDisciplines: string[];
  lessonLevels: string[];
  /** open-barn / closed-barn trainer policy (subset of POLICIES) */
  policies: string[];
}

export async function updateDisciplines(businessId: string, input: DisciplinesInput) {
  const disciplines = sanitizeFacet("disciplines", input.disciplines);
  const trainingTypes = sanitizeFacet("trainingTypes", input.trainingTypes);
  const trainingDisciplines = sanitizeFacet("trainingDisciplines", input.trainingDisciplines);
  const lessonLevels = sanitizeFacet("lessonLevels", input.lessonLevels);
  // Only the barn-trainer policy slugs belong to this tab.
  const policies = sanitizeFacet("policies", input.policies).filter((p) =>
    TRAINER_POLICY_SLUGS.has(p),
  );

  return prisma.$transaction(async (tx) => {
    // This tab owns only the trainer-policy slugs of `policies`; merge them with
    // any non-trainer policy slugs already set (owned by the Facility tab).
    const current = await tx.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { policies: true },
    });
    const otherPolicies = current.policies.filter((p) => !TRAINER_POLICY_SLUGS.has(p));
    const mergedPolicies = dedupe([...otherPolicies, ...policies]);

    const ownerEditedFacets = await mergedEditedFacets(tx, businessId, [
      "disciplines",
      "trainingTypes",
      "trainingDisciplines",
      "lessonLevels",
      "policies",
    ]);
    return tx.business.update({
      where: { id: businessId },
      data: {
        disciplines,
        trainingTypes,
        trainingDisciplines,
        lessonLevels,
        policies: mergedPolicies,
        ownerEditedFacets,
      },
      select: {
        id: true,
        disciplines: true,
        trainingTypes: true,
        trainingDisciplines: true,
        lessonLevels: true,
        policies: true,
        ownerEditedFacets: true,
      },
    });
  });
}

// Facility & Security tab: amenities + securityFeatures + policies.
export interface FacilityInput {
  amenities: string[];
  securityFeatures: string[];
  policies: string[];
}

export async function updateFacility(businessId: string, input: FacilityInput) {
  const amenities = sanitizeFacet("amenities", input.amenities);
  const securityFeatures = sanitizeFacet("securityFeatures", input.securityFeatures);
  // This tab owns the general policy slugs; the trainer (Disciplines) and access
  // (Boarding) slugs are owned by other tabs and preserved here.
  const policies = sanitizeFacet("policies", input.policies).filter(
    (p) => !TRAINER_POLICY_SLUGS.has(p) && !ACCESS_POLICY_SLUGS.has(p),
  );

  return prisma.$transaction(async (tx) => {
    const current = await tx.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { policies: true },
    });
    const reservedPolicies = current.policies.filter(
      (p) => TRAINER_POLICY_SLUGS.has(p) || ACCESS_POLICY_SLUGS.has(p),
    );
    const mergedPolicies = dedupe([...reservedPolicies, ...policies]);

    const ownerEditedFacets = await mergedEditedFacets(tx, businessId, [
      "amenities",
      "securityFeatures",
      "policies",
    ]);
    return tx.business.update({
      where: { id: businessId },
      data: { amenities, securityFeatures, policies: mergedPolicies, ownerEditedFacets },
      select: {
        id: true,
        amenities: true,
        securityFeatures: true,
        policies: true,
        ownerEditedFacets: true,
      },
    });
  });
}

// Programs & Camps tab: the programs JSON list (validated shape). Accepts the
// raw client value; sanitizePrograms validates and drops invalid entries.
export async function updatePrograms(businessId: string, programs: unknown) {
  const clean = sanitizePrograms(programs);
  return prisma.$transaction(async (tx) => {
    const ownerEditedFacets = await mergedEditedFacets(tx, businessId, ["programs"]);
    return tx.business.update({
      where: { id: businessId },
      data: {
        programs: clean.length > 0 ? (clean as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        ownerEditedFacets,
      },
      select: { id: true, programs: true, ownerEditedFacets: true },
    });
  });
}

// --- JSON shape validation (server-side; never trust the client blob). ---

// Each policy slug has exactly one owning tab so saves never clobber each other:
//  - open-barn / closed-barn → Disciplines tab (trainer policy)
//  - 24-7-access / daylight-access-only → Boarding tab (access policy)
//  - everything else → Facility tab
export const TRAINER_POLICY_SLUGS = new Set(["open-barn", "closed-barn"]);
export const ACCESS_POLICY_SLUGS = new Set(["24-7-access", "daylight-access-only"]);

export interface PriceEntry {
  from: number | null;
  to: number | null;
  included: string[];
}
export type PricingMap = Record<string, PriceEntry>;

const MAX_INCLUDED = 20;
const MAX_INCLUDED_LEN = 60;

// Validate the per-board-type pricing map: keys must be valid boardTypes that the
// owner selected; from/to are non-negative ints (to >= from when both present);
// included is a capped list of trimmed strings.
export function sanitizePricing(input: unknown, allowedBoardTypes: string[]): PricingMap {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const allowed = new Set(sanitizeFacet("boardTypes", allowedBoardTypes));
  const out: PricingMap = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!allowed.has(key)) continue;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    const from = toMoney(r.from);
    const to = toMoney(r.to);
    if (from != null && to != null && to < from) continue;
    const included: string[] = [];
    const seen = new Set<string>();
    if (Array.isArray(r.included)) {
      for (const item of r.included) {
        if (typeof item !== "string") continue;
        const v = item.trim().slice(0, MAX_INCLUDED_LEN);
        if (!v || seen.has(v.toLowerCase())) continue;
        seen.add(v.toLowerCase());
        included.push(v);
        if (included.length >= MAX_INCLUDED) break;
      }
    }
    // Skip wholly-empty entries.
    if (from == null && to == null && included.length === 0) continue;
    out[key] = { from, to, included };
  }
  return out;
}

function toMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function derivePriceFrom(pricing: PricingMap): number | null {
  let min: number | null = null;
  for (const entry of Object.values(pricing)) {
    if (entry.from != null && (min == null || entry.from < min)) min = entry.from;
  }
  return min;
}

export interface ProgramEntry {
  id: string;
  type: string;
  name: string;
  season?: string;
  price?: number | null;
  ageRange?: string;
  capacity?: number | null;
}

const MAX_PROGRAMS = 50;
const MAX_TEXT = 80;

// Validate the programs list: type must be a valid PROGRAM_TYPES slug, name is
// required; season/ageRange are capped strings; price/capacity are non-negative
// ints. Each entry gets a stable id (preserved if the client supplied one).
export function sanitizePrograms(input: unknown): ProgramEntry[] {
  if (!Array.isArray(input)) return [];
  const out: ProgramEntry[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    const type = typeof r.type === "string" ? r.type.trim() : "";
    if (!PROGRAM_TYPE_SLUGS.has(type)) continue;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, MAX_TEXT) : "";
    if (!name) continue;
    const entry: ProgramEntry = {
      id: typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 40) : cryptoId(),
      type,
      name,
    };
    if (typeof r.season === "string" && r.season.trim())
      entry.season = r.season.trim().slice(0, MAX_TEXT);
    if (typeof r.ageRange === "string" && r.ageRange.trim())
      entry.ageRange = r.ageRange.trim().slice(0, MAX_TEXT);
    const price = toMoney(r.price);
    if (price != null) entry.price = price;
    const capacity = toMoney(r.capacity);
    if (capacity != null) entry.capacity = capacity;
    out.push(entry);
    if (out.length >= MAX_PROGRAMS) break;
  }
  return out;
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Non-negative integer or null helper for the boarding numeric facets.
export function toCount(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function toAcreage(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
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

// ─────────────────────────── Monetization (tiers) ───────────────────────────
// See specs/monetization-tiers.md. Every owner gate reads getEntitlements(business)
// (src/lib/entitlements.ts), so the loaders below always pull the subscription +
// active spotlights the resolver needs. Trainers/Events are TEAM/EVENTS-tier
// editors; the logo + stalls badge live on the VERIFIED tier.

// Minimal include for the entitlements resolver — subscription + spotlights only.
export const entitlementsInclude = {
  subscription: true,
  spotlights: true,
} satisfies Prisma.BusinessInclude;

export type BusinessWithEntitlements = Prisma.BusinessGetPayload<{
  include: typeof entitlementsInclude;
}>;

// Load the relations getEntitlements(business) needs (subscription + spotlights)
// for a business already authorized upstream. Returns null if the row is gone.
export function loadBusinessForEntitlements(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    include: entitlementsInclude,
  });
}

// --- Stalls-Available badge: a boolean stashed in Business.attributes. Rendered
// publicly only when the business is entitled (stallsBadge) AND this flag is on.
// Written through the same server-merge as offering so crawled attributes survive.
export async function setStallsBadge(businessId: string, on: boolean) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { attributes: true },
    });
    const merged = stripProtectedAttributeKeys({
      ...asRecord(current.attributes),
      stallsBadge: on,
    });
    if (!on) delete merged.stallsBadge;
    return tx.business.update({
      where: { id: businessId },
      data: { attributes: merged as Prisma.InputJsonValue },
      select: { id: true, attributes: true },
    });
  });
}

/** Read the stalls-badge flag from a business's attributes JSON. */
export function readStallsBadge(attrs: Prisma.JsonValue | null | undefined): boolean {
  return asRecord(attrs).stallsBadge === true;
}

// --- Logo (BusinessImage source:OWNER, isLogo:true). Max one logo per business;
// uploading a new one replaces the old. The logo does NOT count against the
// owner-image quota (maxImages counts source:OWNER, isLogo:false). ---

export function getLogo(businessId: string) {
  return prisma.businessImage.findFirst({
    where: { businessId, source: "OWNER", isLogo: true },
    select: { id: true, url: true },
  });
}

// Replace the logo: delete any existing logo row, insert the new one. Returns the
// previous logo url (for best-effort blob cleanup by the caller).
export async function setLogo(businessId: string, url: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.businessImage.findMany({
      where: { businessId, source: "OWNER", isLogo: true },
      select: { id: true, url: true },
    });
    if (existing.length) {
      await tx.businessImage.deleteMany({
        where: { id: { in: existing.map((e) => e.id) } },
      });
    }
    const image = await tx.businessImage.create({
      data: { businessId, url, source: "OWNER", isLogo: true, rank: -1 },
      select: { id: true, url: true },
    });
    return { image, previousUrls: existing.map((e) => e.url) };
  });
}

export async function deleteLogo(businessId: string) {
  const logo = await prisma.businessImage.findFirst({
    where: { businessId, source: "OWNER", isLogo: true },
    select: { id: true, url: true },
  });
  if (!logo) return null;
  await prisma.businessImage.delete({ where: { id: logo.id } });
  return logo;
}

// Count NON-logo OWNER images for the maxImages quota gate (logo is excluded).
export function countOwnerPhotos(businessId: string) {
  return prisma.businessImage.count({
    where: { businessId, source: "OWNER", isLogo: false },
  });
}

// --- Trainers (TEAM tier). CRUD over Trainer rows. disciplines validated against
// the shared facet vocab; slug derived from the name (unique per business). ---

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Ensure a unique [businessId, slug] by appending -2, -3, … on collision.
// `excludeId` lets an update keep its own slug.
async function uniqueChildSlug(
  model: "trainer" | "event",
  businessId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = base || model;
  let candidate = root;
  for (let i = 2; i < 1000; i++) {
    const where = { businessId, slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) };
    const existing =
      model === "trainer"
        ? await prisma.trainer.findFirst({ where, select: { id: true } })
        : await prisma.event.findFirst({ where, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export interface TrainerInput {
  name: string;
  bio?: string | null;
  photoUrl?: string | null;
  disciplines: string[];
  certifications: string[];
  email?: string | null;
  phone?: string | null;
}

const MAX_CERTS = 20;
const MAX_CERT_LEN = 120;

function cleanCerts(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string") continue;
    const t = v.trim().slice(0, MAX_CERT_LEN);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= MAX_CERTS) break;
  }
  return out;
}

export function listTrainers(businessId: string) {
  return prisma.trainer.findMany({
    where: { businessId },
    orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
  });
}

export function countTrainers(businessId: string) {
  return prisma.trainer.count({ where: { businessId } });
}

export async function createTrainer(businessId: string, input: TrainerInput) {
  const slug = await uniqueChildSlug("trainer", businessId, slugify(input.name));
  return prisma.trainer.create({
    data: {
      businessId,
      name: input.name.slice(0, 255),
      slug,
      bio: input.bio ?? null,
      photoUrl: input.photoUrl ?? null,
      disciplines: sanitizeFacet("disciplines", input.disciplines),
      certifications: cleanCerts(input.certifications),
      email: input.email ?? null,
      phone: input.phone ?? null,
    },
  });
}

export async function updateTrainer(
  businessId: string,
  trainerId: string,
  input: TrainerInput,
) {
  const existing = await prisma.trainer.findFirst({
    where: { id: trainerId, businessId },
    select: { id: true, slug: true, name: true },
  });
  if (!existing) return null;
  // Re-derive the slug only when the name changed (keeps stable URLs otherwise).
  const slug =
    input.name.trim() && slugify(input.name) !== existing.slug
      ? await uniqueChildSlug("trainer", businessId, slugify(input.name), trainerId)
      : existing.slug;
  return prisma.trainer.update({
    where: { id: existing.id },
    data: {
      name: input.name.slice(0, 255),
      slug,
      bio: input.bio ?? null,
      photoUrl: input.photoUrl ?? null,
      disciplines: sanitizeFacet("disciplines", input.disciplines),
      certifications: cleanCerts(input.certifications),
      email: input.email ?? null,
      phone: input.phone ?? null,
    },
  });
}

export async function deleteTrainer(businessId: string, trainerId: string) {
  const existing = await prisma.trainer.findFirst({
    where: { id: trainerId, businessId },
    select: { id: true, photoUrl: true },
  });
  if (!existing) return null;
  await prisma.trainer.delete({ where: { id: existing.id } });
  return existing;
}

// --- Events (EVENTS tier). CRUD over Event rows. type validated against the
// program-type vocab; locationId defaults to the business's own city. ---

export interface EventInput {
  type: string;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate?: Date | null;
  price?: number | null;
  registrationUrl?: string | null;
  imageUrl?: string | null;
  isPublished: boolean;
  locationId?: string | null;
}

export function listEvents(businessId: string) {
  return prisma.event.findMany({
    where: { businessId },
    orderBy: [{ startDate: "asc" }],
  });
}

export async function createEvent(businessId: string, input: EventInput) {
  const slug = await uniqueChildSlug("event", businessId, slugify(input.title));
  // Default the event's location to the business's own city for the geo surface.
  const locationId =
    input.locationId ??
    (await prisma.business.findUnique({ where: { id: businessId }, select: { locationId: true } }))
      ?.locationId ??
    null;
  return prisma.event.create({
    data: {
      businessId,
      type: input.type,
      title: input.title.slice(0, 255),
      slug,
      description: input.description ?? null,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      price: input.price ?? null,
      registrationUrl: input.registrationUrl ?? null,
      imageUrl: input.imageUrl ?? null,
      isPublished: input.isPublished,
      locationId,
    },
  });
}

export async function updateEvent(businessId: string, eventId: string, input: EventInput) {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, businessId },
    select: { id: true, slug: true },
  });
  if (!existing) return null;
  const slug =
    input.title.trim() && slugify(input.title) !== existing.slug
      ? await uniqueChildSlug("event", businessId, slugify(input.title), eventId)
      : existing.slug;
  return prisma.event.update({
    where: { id: existing.id },
    data: {
      type: input.type,
      title: input.title.slice(0, 255),
      slug,
      description: input.description ?? null,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      price: input.price ?? null,
      registrationUrl: input.registrationUrl ?? null,
      imageUrl: input.imageUrl ?? null,
      isPublished: input.isPublished,
    },
  });
}

export async function deleteEvent(businessId: string, eventId: string) {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, businessId },
    select: { id: true, imageUrl: true },
  });
  if (!existing) return null;
  await prisma.event.delete({ where: { id: existing.id } });
  return existing;
}
