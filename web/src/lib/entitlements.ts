// Monetization entitlements — the single resolver every owner/public gate reads
// (see specs/monetization-tiers.md §"Entitlements resolver"). Features move
// between tiers by editing TIER_CONFIG here; gate call-sites never change.
//
// Tiers form a cumulative ladder: VERIFIED ⊂ TEAM ⊂ EVENTS. SPOTLIGHT is a
// separate add-on (a Spotlight row whose [startsAt, endsAt] window covers now),
// resolved independently of the tier.
//
// Display is always public (SEO): a FREE/unclaimed barn still shows crawler
// facets + public reviews — the owner just can't *edit*/collect until VERIFIED.
//
// Legacy SubTier values (PRO/PREMIUM) from the accounts system map onto the new
// ladder so existing rows keep working: PRO→TEAM, PREMIUM→EVENTS.

import type { SubTier } from "@prisma/client";

// ─────────────────────────── Pricing (cents) ───────────────────────────
// Single source of truth for prices. Easy to change; consumed by the Plan/Upgrade
// UI and the Stripe product/checkout layer (stage 4).
export const PRICES = {
  verified: { monthly: 299, yearly: 2500 },
  trainerSeat: { yearly: 1000 },
  events: { yearly: 4900 },
  spotlight: { weekly: 2500 },
} as const;

// ─────────────────────────── Entitlements ───────────────────────────

export type Entitlements = {
  /** The resolved owner tier. */
  tier: SubTier;
  /** Max owner-uploaded images (excluding the logo). FREE 0, VERIFIED+ 5. */
  maxImages: number;
  /** Owner may upload a logo (1 max). VERIFIED+. */
  canLogo: boolean;
  /** "Stalls Available" badge overlay on images. VERIFIED+. */
  stallsBadge: boolean;
  /** Owner may collect + respond to reviews (display is always public). VERIFIED+. */
  canCollectReviews: boolean;
  /** Owner may edit rich facets (disciplines/board/pricing/amenities/…). VERIFIED+. */
  canEditFacets: boolean;
  /** Max trainer profiles. TEAM: TRAINER_SEATS_INCLUDED + subscription.trainerSeats. */
  maxTrainers: number;
  /** Owner may publish events/shows/clinics/camps. EVENTS. */
  canEvents: boolean;
  /** An active Spotlight row covers now ([startsAt, endsAt]). */
  spotlightActive: boolean;
  /** The city (Location) the active Spotlight targets, else null. */
  spotlightLocationId: string | null;
};

// Trainer seats bundled into the TEAM tier before per-seat charges kick in.
export const TRAINER_SEATS_INCLUDED = 2;
// Owner image quota for entitled (VERIFIED+) barns.
export const VERIFIED_MAX_IMAGES = 5;

// Per-tier feature flags (everything except the seat/spotlight counts that depend
// on row state). The ladder is cumulative, so each higher tier sets every lower
// flag too. Legacy PRO/PREMIUM are aliased onto TEAM/EVENTS.
type TierFlags = Omit<Entitlements, "tier" | "spotlightActive" | "spotlightLocationId" | "maxTrainers"> & {
  /** Base trainer seats granted by the tier (before subscription.trainerSeats). */
  baseTrainers: number;
};

const FREE_FLAGS: TierFlags = {
  maxImages: 0,
  canLogo: false,
  stallsBadge: false,
  canCollectReviews: false,
  canEditFacets: false,
  canEvents: false,
  baseTrainers: 0,
};

const VERIFIED_FLAGS: TierFlags = {
  maxImages: VERIFIED_MAX_IMAGES,
  canLogo: true,
  stallsBadge: true,
  canCollectReviews: true,
  canEditFacets: true,
  canEvents: false,
  baseTrainers: 0,
};

const TEAM_FLAGS: TierFlags = {
  ...VERIFIED_FLAGS,
  baseTrainers: TRAINER_SEATS_INCLUDED,
};

const EVENTS_FLAGS: TierFlags = {
  ...TEAM_FLAGS,
  canEvents: true,
};

// Maps every SubTier (incl. legacy PRO/PREMIUM) to its flag set.
export const TIER_CONFIG: Record<SubTier, TierFlags> = {
  FREE: FREE_FLAGS,
  VERIFIED: VERIFIED_FLAGS,
  TEAM: TEAM_FLAGS,
  EVENTS: EVENTS_FLAGS,
  // Legacy accounts-system tiers aliased onto the new ladder.
  PRO: TEAM_FLAGS,
  PREMIUM: EVENTS_FLAGS,
};

// ─────────────────────────── Resolver ───────────────────────────

// Minimal shapes the resolver needs — accepts any Business loaded with its
// subscription + spotlights (e.g. Prisma.BusinessGetPayload<{ include: ... }>).
type SubscriptionLike = {
  tier: SubTier;
  status: string;
  trainerSeats: number;
} | null;

type SpotlightLike = {
  locationId: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
};

type BusinessLike = {
  subscription?: SubscriptionLike;
  spotlights?: SpotlightLike[] | null;
};

// A subscription only grants its tier while it is paying. PAST_DUE keeps access
// during the dunning window; CANCELED/INCOMPLETE drop to FREE.
function payingTier(sub: SubscriptionLike): SubTier {
  if (!sub) return "FREE";
  if (sub.status === "ACTIVE" || sub.status === "PAST_DUE") return sub.tier;
  return "FREE";
}

/** The active spotlight covering `now`, if any, from a business's spotlight rows. */
export function activeSpotlight(
  spotlights: SpotlightLike[] | null | undefined,
  now: Date = new Date(),
): SpotlightLike | null {
  if (!spotlights?.length) return null;
  for (const s of spotlights) {
    if (s.status === "active" && s.startsAt <= now && now <= s.endsAt) return s;
  }
  return null;
}

/**
 * Resolve a business's entitlements from `subscription.tier` + `trainerSeats` +
 * any active Spotlight row. Pass a business loaded with `subscription` and
 * `spotlights`; missing relations resolve to FREE / no-spotlight.
 */
export function getEntitlements(business: BusinessLike, now: Date = new Date()): Entitlements {
  const sub = business.subscription ?? null;
  const tier = payingTier(sub);
  const flags = TIER_CONFIG[tier];

  const seats = sub?.trainerSeats ?? 0;
  const maxTrainers = flags.baseTrainers > 0 ? flags.baseTrainers + seats : 0;

  const spot = activeSpotlight(business.spotlights, now);

  return {
    tier,
    maxImages: flags.maxImages,
    canLogo: flags.canLogo,
    stallsBadge: flags.stallsBadge,
    canCollectReviews: flags.canCollectReviews,
    canEditFacets: flags.canEditFacets,
    maxTrainers,
    canEvents: flags.canEvents,
    spotlightActive: spot !== null,
    spotlightLocationId: spot?.locationId ?? null,
  };
}

// ─────────────────────────── Convenience helpers ───────────────────────────
// Thin wrappers so downstream gates can read a single field without destructuring.

export function canEditFacets(business: BusinessLike): boolean {
  return getEntitlements(business).canEditFacets;
}

export function maxImages(business: BusinessLike): number {
  return getEntitlements(business).maxImages;
}

export function maxTrainers(business: BusinessLike): number {
  return getEntitlements(business).maxTrainers;
}

export function spotlightActive(business: BusinessLike, now: Date = new Date()): boolean {
  return activeSpotlight(business.spotlights, now) !== null;
}
