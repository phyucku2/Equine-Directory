import { prisma } from "@/lib/prisma";
import type { Prisma, SubTier } from "@prisma/client";
import { PRICES } from "@/lib/entitlements";
import { MAX_SPOTLIGHTS_PER_CITY } from "@/lib/db/spotlight";

// Paid-state writers shared by the Stripe webhook (billing on) and the admin
// manual-grant action (beta). specs/monetization-tiers.md §"Billing + admin":
// admins grant a tier / seats / spotlight without payment during beta, and the
// webhook performs the same writes when Stripe confirms a checkout. Keeping both
// paths in one place means rotation/expiry rules can't drift between them.
//
// Spotlight rules enforced here:
//   - max MAX_SPOTLIGHTS_PER_CITY (3) *active* windows per city at any instant,
//   - windows beyond the cap are created with status "queued" (not "active"),
//   - expiry is by endsAt (on-read filtering elsewhere already ignores past
//     windows; `expireStaleSpotlights` also flips status for tidiness/queries).

// ─────────────────────────── Subscription grants ───────────────────────────

// Raise a business to a tier (and optionally set trainer seats), marking the
// subscription ACTIVE. Never downgrades silently: callers pass the explicit tier.
// `performedBy` lands in the audit log ("admin:<email>" or "stripe-webhook").
export async function grantTier(opts: {
  businessId: string;
  tier: SubTier;
  /** Absolute trainer-seat count to set. Omit to leave the existing value. */
  trainerSeats?: number;
  /** Stripe ids, when the grant originates from a real subscription. */
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  performedBy: string;
}) {
  const { businessId, tier, performedBy } = opts;
  const seatData =
    opts.trainerSeats !== undefined ? { trainerSeats: Math.max(0, opts.trainerSeats) } : {};

  const [sub] = await prisma.$transaction([
    prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        tier,
        status: "ACTIVE",
        ...seatData,
        stripeCustomerId: opts.stripeCustomerId ?? null,
        stripeSubscriptionId: opts.stripeSubscriptionId ?? null,
        currentPeriodEnd: opts.currentPeriodEnd ?? null,
      },
      update: {
        tier,
        status: "ACTIVE",
        ...seatData,
        ...(opts.stripeCustomerId !== undefined ? { stripeCustomerId: opts.stripeCustomerId } : {}),
        ...(opts.stripeSubscriptionId !== undefined
          ? { stripeSubscriptionId: opts.stripeSubscriptionId }
          : {}),
        ...(opts.currentPeriodEnd !== undefined ? { currentPeriodEnd: opts.currentPeriodEnd } : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        action: "TIER_GRANTED",
        entityType: "Business",
        entityId: businessId,
        performedBy,
        details: { tier, trainerSeats: opts.trainerSeats ?? null } as Prisma.InputJsonValue,
      },
    }),
  ]);
  return sub;
}

// Add N trainer seats on top of the current count (clamped at >= 0). Used by the
// per-seat add-on (admin grant + webhook). Creates a TEAM subscription if none
// exists, since seats only make sense at TEAM+.
export async function addTrainerSeats(opts: {
  businessId: string;
  quantity: number;
  performedBy: string;
}) {
  const { businessId, quantity, performedBy } = opts;
  const existing = await prisma.subscription.findUnique({
    where: { businessId },
    select: { trainerSeats: true, tier: true },
  });
  const nextSeats = Math.max(0, (existing?.trainerSeats ?? 0) + quantity);
  // Seats require the trainer feature; if the barn isn't at least TEAM, lift it.
  const nextTier: SubTier =
    existing && (existing.tier === "TEAM" || existing.tier === "EVENTS" || existing.tier === "PRO" || existing.tier === "PREMIUM")
      ? existing.tier
      : "TEAM";
  return grantTier({ businessId, tier: nextTier, trainerSeats: nextSeats, performedBy });
}

// ─────────────────────────── Spotlight grants ───────────────────────────

export type SpotlightGrantResult = {
  spotlight: { id: string; status: string; startsAt: Date; endsAt: Date };
  /** true when the window was created active, false when queued behind the cap. */
  active: boolean;
  /** number of active windows already covering the start instant in this city. */
  activeAtStart: number;
};

// Count active spotlight windows covering `at` in a city (the cap check input).
export async function countActiveSpotlights(
  locationId: string,
  at: Date = new Date(),
): Promise<number> {
  return prisma.spotlight.count({
    where: {
      locationId,
      status: "active",
      startsAt: { lte: at },
      endsAt: { gte: at },
    },
  });
}

// Create a spotlight window for a city. Enforces the per-city cap: if 3 windows
// are already active at the start instant, the new one is created "queued" so it
// surfaces nowhere until promoted (admin can extend/rotate). On-read filtering
// (getActiveSpotlightsForLocation) independently caps the rendered slots at 3.
export async function createSpotlight(opts: {
  businessId: string;
  locationId: string;
  weeks: number;
  startsAt?: Date;
  weeklyRateCents?: number;
  purchaseId?: string | null;
  performedBy: string;
}): Promise<SpotlightGrantResult> {
  const startsAt = opts.startsAt ?? new Date();
  const endsAt = new Date(startsAt.getTime() + opts.weeks * 7 * 24 * 60 * 60 * 1000);
  const weeklyRateCents = opts.weeklyRateCents ?? PRICES.spotlight.weekly;

  const activeAtStart = await countActiveSpotlights(opts.locationId, startsAt);
  const status = activeAtStart >= MAX_SPOTLIGHTS_PER_CITY ? "queued" : "active";

  const [spotlight] = await prisma.$transaction([
    prisma.spotlight.create({
      data: {
        businessId: opts.businessId,
        locationId: opts.locationId,
        startsAt,
        endsAt,
        weeklyRateCents,
        status,
        purchaseId: opts.purchaseId ?? null,
      },
      select: { id: true, status: true, startsAt: true, endsAt: true },
    }),
    prisma.auditLog.create({
      data: {
        action: "SPOTLIGHT_GRANTED",
        entityType: "Business",
        entityId: opts.businessId,
        performedBy: opts.performedBy,
        details: {
          locationId: opts.locationId,
          weeks: opts.weeks,
          status,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        } as Prisma.InputJsonValue,
      },
    }),
  ]);

  return { spotlight, active: status === "active", activeAtStart };
}

// Expiry sweep: flip any "active" window whose endsAt has passed to "expired",
// and promote the oldest "queued" window per freed city slot to "active" (only
// if its own window still covers now). Idempotent; safe to call on read or from
// a scheduled job. Returns counts for logging.
export async function expireStaleSpotlights(now: Date = new Date()): Promise<{
  expired: number;
  promoted: number;
}> {
  // 1) Expire windows that have ended.
  const expired = await prisma.spotlight.updateMany({
    where: { status: "active", endsAt: { lt: now } },
    data: { status: "expired" },
  });

  // 2) Promote queued windows into freed slots, per city, oldest-first.
  const queued = await prisma.spotlight.findMany({
    where: { status: "queued", startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    select: { id: true, locationId: true },
  });

  let promoted = 0;
  // Track remaining capacity per city as we promote within this pass.
  const capacity = new Map<string, number>();
  for (const q of queued) {
    let cap = capacity.get(q.locationId);
    if (cap === undefined) {
      const activeNow = await countActiveSpotlights(q.locationId, now);
      cap = MAX_SPOTLIGHTS_PER_CITY - activeNow;
      capacity.set(q.locationId, cap);
    }
    if (cap <= 0) continue;
    await prisma.spotlight.update({ where: { id: q.id }, data: { status: "active" } });
    capacity.set(q.locationId, cap - 1);
    promoted += 1;
  }

  return { expired: expired.count, promoted };
}

// ─────────────────────────── Purchase ledger ───────────────────────────

// Record a Purchase row (the money ledger). Idempotent on stripePaymentId when
// provided; admin grants pass a synthetic id so beta grants are also auditable.
export async function recordPurchase(opts: {
  businessId: string;
  product: string;
  amountCents: number;
  stripePaymentId?: string | null;
  expiresAt?: Date | null;
}) {
  const { businessId, product, amountCents } = opts;
  if (opts.stripePaymentId) {
    return prisma.purchase.upsert({
      where: { stripePaymentId: opts.stripePaymentId },
      create: {
        businessId,
        product,
        amount: amountCents,
        stripePaymentId: opts.stripePaymentId,
        expiresAt: opts.expiresAt ?? null,
      },
      update: { amount: amountCents, expiresAt: opts.expiresAt ?? null },
    });
  }
  return prisma.purchase.create({
    data: { businessId, product, amount: amountCents, expiresAt: opts.expiresAt ?? null },
  });
}
