// Stripe products/prices layer (specs/monetization-tiers.md §"Billing").
//
// Single mapping from a Plan-tab request (the PlanRequest kinds the owner Plan UI
// sends) onto the Stripe line items + metadata the checkout session needs, and
// back onto the paid state the webhook writes. Price IDs live in env so the same
// build works across Stripe test/live without code changes; PRICES (cents) stays
// the source of truth for amounts shown in the UI and recorded on Purchase rows.
//
// Inert in beta: nothing here calls Stripe. It only produces plain config that
// the checkout route (guarded by `if (!stripe) 503`) consumes when BILLING_ENABLED.

import type { SubTier } from "@prisma/client";
import { PRICES } from "@/lib/entitlements";

// The request kinds the Plan tab can send. Mirrors the union in
// api/owner/businesses/[id]/plan/route.ts (kept in sync intentionally).
export type PlanRequest =
  | { kind: "verified"; cycle: "monthly" | "yearly" }
  | { kind: "trainerSeat"; quantity: number }
  | { kind: "events" }
  | { kind: "spotlight"; locationId: string; weeks: number };

// Stripe price IDs, resolved from env. Each is the recurring/one-off price you
// create once in the Stripe dashboard (or via `stripe prices create`). Absent
// values surface as a clear "price not configured" error rather than a bad call.
export const STRIPE_PRICE_IDS = {
  verifiedMonthly: process.env.STRIPE_PRICE_VERIFIED_MONTHLY,
  verifiedYearly: process.env.STRIPE_PRICE_VERIFIED_YEARLY,
  trainerSeatYearly: process.env.STRIPE_PRICE_TRAINER_SEAT_YEARLY,
  eventsYearly: process.env.STRIPE_PRICE_EVENTS_YEARLY,
  spotlightWeekly: process.env.STRIPE_PRICE_SPOTLIGHT_WEEKLY,
} as const;

// Stripe checkout metadata we attach so the webhook can reconstruct what was
// bought (the webhook is the ONLY writer of paid state). Everything is keyed off
// businessId; product-specific fields ride alongside.
export type CheckoutMetadata = {
  businessId: string;
  // The plan kind, so the webhook routes the completed session correctly.
  planKind: PlanRequest["kind"];
  // verified: which tier the subscription grants.
  tier?: SubTier;
  // trainerSeat: how many seats this purchase adds.
  trainerSeats?: string;
  // spotlight: which city + how many weeks.
  spotlightLocationId?: string;
  spotlightWeeks?: string;
  // estimated amount in cents (for the Purchase ledger fallback).
  amountCents?: string;
};

export type CheckoutPlan = {
  mode: "subscription" | "payment";
  lineItems: { price: string; quantity: number }[];
  metadata: CheckoutMetadata;
  label: string;
  amountCents: number;
};

class MissingPriceError extends Error {}

function requirePrice(id: string | undefined, name: string): string {
  if (!id) throw new MissingPriceError(`Stripe price not configured: ${name}`);
  return id;
}

// The SubTier a "verified" subscription request maps to. Verified is the entry
// paid tier; TEAM/EVENTS are reached by adding the seat/events add-ons on top,
// which the webhook folds into the same Subscription row.
const VERIFIED_TIER: SubTier = "VERIFIED";

/**
 * Translate a validated PlanRequest into the Stripe checkout config. Throws
 * `MissingPriceError` (mapped to a 503 by the caller) if the matching price ID
 * isn't configured. Never calls Stripe — pure config.
 */
export function checkoutPlanFor(businessId: string, req: PlanRequest): CheckoutPlan {
  switch (req.kind) {
    case "verified": {
      const price =
        req.cycle === "yearly"
          ? requirePrice(STRIPE_PRICE_IDS.verifiedYearly, "verifiedYearly")
          : requirePrice(STRIPE_PRICE_IDS.verifiedMonthly, "verifiedMonthly");
      const amountCents = req.cycle === "yearly" ? PRICES.verified.yearly : PRICES.verified.monthly;
      return {
        mode: "subscription",
        lineItems: [{ price, quantity: 1 }],
        metadata: {
          businessId,
          planKind: "verified",
          tier: VERIFIED_TIER,
          amountCents: String(amountCents),
        },
        label: `Verified plan (${req.cycle})`,
        amountCents,
      };
    }
    case "trainerSeat": {
      const price = requirePrice(STRIPE_PRICE_IDS.trainerSeatYearly, "trainerSeatYearly");
      const amountCents = PRICES.trainerSeat.yearly * req.quantity;
      return {
        mode: "subscription",
        lineItems: [{ price, quantity: req.quantity }],
        metadata: {
          businessId,
          planKind: "trainerSeat",
          trainerSeats: String(req.quantity),
          amountCents: String(amountCents),
        },
        label: `${req.quantity} trainer seat(s)`,
        amountCents,
      };
    }
    case "events": {
      const price = requirePrice(STRIPE_PRICE_IDS.eventsYearly, "eventsYearly");
      const amountCents = PRICES.events.yearly;
      return {
        mode: "subscription",
        lineItems: [{ price, quantity: 1 }],
        metadata: {
          businessId,
          planKind: "events",
          tier: "EVENTS",
          amountCents: String(amountCents),
        },
        label: "Events plan",
        amountCents,
      };
    }
    case "spotlight": {
      const price = requirePrice(STRIPE_PRICE_IDS.spotlightWeekly, "spotlightWeekly");
      const amountCents = PRICES.spotlight.weekly * req.weeks;
      // Spotlight is a one-off purchase of N weeks (not a recurring sub): a single
      // weekly price with quantity = weeks, charged once.
      return {
        mode: "payment",
        lineItems: [{ price, quantity: req.weeks }],
        metadata: {
          businessId,
          planKind: "spotlight",
          spotlightLocationId: req.locationId,
          spotlightWeeks: String(req.weeks),
          amountCents: String(amountCents),
        },
        label: `Spotlight · ${req.weeks} week(s)`,
        amountCents,
      };
    }
  }
}

export { MissingPriceError };
