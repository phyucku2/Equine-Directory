import type { Subscription, SubTier, VerificationBadge } from "@prisma/client";
import { BETA_FREE_EVERYTHING } from "./beta";

// The single entitlement resolver. Every owner-side gate (photo upload, analytics
// panel, microsite, badge ceiling) calls this one function. During beta
// (BETA_FREE_EVERYTHING) it returns full PRO + all add-ons so every owner feature
// is unlocked with zero Stripe configuration. Outside beta it maps the live
// Subscription tier (FREE/PRO/PREMIUM) + the add-on state carried in
// `Business.attributes.addons` (written only by the Stripe webhook) to concrete
// gates. Tiers map 1:1 to real fields: owner-photo upload (Pro-gated insert of
// BusinessImage source:OWNER), verificationBadge ceiling (FREE->VERIFIED,
// PRO->TRUSTED, PREMIUM/microsite->PREMIUM), analytics.

export interface Entitlements {
  /** Owner can upload photos (BusinessImage source:OWNER). */
  ownerPhotos: boolean;
  /** Owner analytics panel. */
  analytics: boolean;
  /** Custom microsite. */
  microsite: boolean;
  /** Max photos an owner can have. */
  maxPhotos: number;
  /** The highest verification badge this tier may reach. */
  badgeCeiling: VerificationBadge;
  /** One-off "featured placement" add-on is active (from attributes.addons). */
  featured: boolean;
}

const FULL_PRO: Entitlements = {
  ownerPhotos: true,
  analytics: true,
  microsite: true,
  maxPhotos: 50,
  badgeCeiling: "PREMIUM",
  featured: true,
};

const FREE: Entitlements = {
  ownerPhotos: false,
  analytics: false,
  microsite: false,
  maxPhotos: 0,
  badgeCeiling: "VERIFIED",
  featured: false,
};

const PRO: Entitlements = {
  ownerPhotos: true,
  analytics: true,
  microsite: false,
  maxPhotos: 25,
  badgeCeiling: "TRUSTED",
  featured: false,
};

const PREMIUM: Entitlements = {
  ownerPhotos: true,
  analytics: true,
  microsite: true,
  maxPhotos: 50,
  badgeCeiling: "PREMIUM",
  featured: false,
};

// The new monetization ladder (see src/lib/entitlements.ts) is resolved by
// getEntitlements(); here the new SubTier values are aliased onto the legacy
// PRO/PREMIUM rows so this older resolver stays exhaustive over SubTier.
const BY_TIER: Record<SubTier, Entitlements> = {
  FREE,
  PRO,
  PREMIUM,
  // Basic ($9/yr entry rung): one owner photo, no analytics/microsite/badge lift.
  BASIC: { ...FREE, ownerPhotos: true, maxPhotos: 1 },
  VERIFIED: PRO,
  TEAM: PRO,
  EVENTS: PREMIUM,
};

// Shape of the add-on state stashed in the nullable Business.attributes JSON.
// Only the Stripe webhook writes this (owner routes strip `addons` per §4).
interface AddonState {
  featured?: boolean;
}

function readAddons(attrs: unknown): AddonState {
  if (!attrs || typeof attrs !== "object") return {};
  const addons = (attrs as Record<string, unknown>).addons;
  if (!addons || typeof addons !== "object") return {};
  return addons as AddonState;
}

/**
 * Resolve the entitlements for a business from its (nullable) Subscription and
 * its `Business.attributes` JSON.
 *
 * - In beta (`BETA_FREE_EVERYTHING`) every business gets full PRO + add-ons.
 * - Otherwise the tier comes from an ACTIVE/PAST_DUE subscription (CANCELED /
 *   INCOMPLETE fall back to FREE), and the `featured` add-on comes from
 *   `attributes.addons.featured`.
 */
export function entitlementsFor(
  sub: Subscription | null | undefined,
  attrs?: unknown,
): Entitlements {
  if (BETA_FREE_EVERYTHING) return FULL_PRO;

  // A subscription only grants its tier while it is paying. PAST_DUE keeps access
  // during the dunning window; CANCELED/INCOMPLETE drop to FREE.
  const paying = sub && (sub.status === "ACTIVE" || sub.status === "PAST_DUE");
  const base = paying ? BY_TIER[sub.tier] : FREE;

  const addons = readAddons(attrs);
  if (!addons.featured) return base;

  return { ...base, featured: true };
}
