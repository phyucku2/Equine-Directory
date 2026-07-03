import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import type { Prisma, SubTier, SubStatus, VerificationBadge } from "@prisma/client";
import { createSpotlight, recordPurchase } from "@/lib/db/grants";
import { PRICES } from "@/lib/entitlements";

// The Stripe webhook — the ONLY writer of paid state. It reconciles verified
// Stripe events into:
//   - Subscription (tier/status/stripe ids/currentPeriodEnd, @@unique businessId)
//   - Business.verificationBadge (reusing the non-downgrade rule from claim.ts)
//   - Business.isFeatured / featuredUntil (one-off "featured" add-on)
//   - Business.attributes.addons (add-on state, server-merged, never client-trusted)
//
// Inert in beta: `stripe` is null unless BILLING_ENABLED + a test-mode key, so
// the first line short-circuits with 503 and signature verification is skipped.
//
// Next.js note: route handlers receive the raw body via `request.text()`; do NOT
// parse JSON before constructing the event or signature verification will fail.

export const runtime = "nodejs";

// Tier ceiling for verificationBadge (FREE->VERIFIED, PRO->TRUSTED, PREMIUM->PREMIUM).
const TIER_BADGE: Record<SubTier, VerificationBadge> = {
  FREE: "VERIFIED",
  PRO: "TRUSTED",
  PREMIUM: "PREMIUM",
  // Monetization ladder (specs/monetization-tiers.md): a paid tier verifies the barn.
  // BASIC is the $9/yr entry rung — no badge upgrade (the badge is Verified's draw).
  BASIC: "UNVERIFIED",
  VERIFIED: "VERIFIED",
  TEAM: "TRUSTED",
  EVENTS: "PREMIUM",
};

const BADGE_RANK: Record<VerificationBadge, number> = {
  UNVERIFIED: 0,
  VERIFIED: 1,
  TRUSTED: 2,
  PREMIUM: 3,
};

// Map a Stripe subscription to our tier. We read it from the price's lookup_key
// (e.g. "verified" / "events"), falling back to subscription metadata `tier`.
// The monetization ladder (VERIFIED/TEAM/EVENTS) and the legacy accounts tiers
// (PRO/PREMIUM) are both recognized; anything unknown stays FREE.
function tierFromSubscription(sub: Stripe.Subscription): SubTier {
  const lookups = (sub.items?.data ?? [])
    .map((i) => i.price?.lookup_key?.toUpperCase())
    .filter((x): x is string => Boolean(x));
  const metaTier = (sub.metadata?.tier ?? "").toUpperCase();
  const candidates = [...lookups, metaTier];
  // Highest tier present wins (events item + verified item ⇒ EVENTS).
  if (candidates.includes("EVENTS") || candidates.includes("PREMIUM")) return "EVENTS";
  if (candidates.includes("TEAM") || candidates.includes("PRO")) return "TEAM";
  if (candidates.includes("VERIFIED")) return "VERIFIED";
  if (candidates.includes("BASIC")) return "BASIC";
  return "FREE";
}

// Trainer seats = the quantity on the trainer-seat line item, identified by its
// price lookup_key ("trainer_seat"). 0 when absent. Also accepts the count from
// subscription metadata as a fallback (admin-set / migrated subs).
function trainerSeatsFromSubscription(sub: Stripe.Subscription): number {
  const seatItem = (sub.items?.data ?? []).find(
    (i) => i.price?.lookup_key?.toLowerCase() === "trainer_seat",
  );
  if (seatItem) return seatItem.quantity ?? 0;
  const metaSeats = Number(sub.metadata?.trainerSeats);
  return Number.isInteger(metaSeats) && metaSeats > 0 ? metaSeats : 0;
}

function statusFromStripe(status: Stripe.Subscription.Status): SubStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "incomplete":
    case "incomplete_expired":
      return "INCOMPLETE";
    default:
      return "CANCELED";
  }
}

// Non-downgrade badge rule (mirrors claim.ts): never lower an existing badge.
function maxBadge(current: VerificationBadge, next: VerificationBadge): VerificationBadge {
  return BADGE_RANK[next] > BADGE_RANK[current] ? next : current;
}

// Server-side merge of add-on state into the nullable Business.attributes JSON.
// Only the webhook touches `attributes.addons` (owner routes strip it per §4).
function mergeAddons(attrs: Prisma.JsonValue | null, patch: Record<string, unknown>): Prisma.InputJsonValue {
  const base = attrs && typeof attrs === "object" && !Array.isArray(attrs) ? { ...(attrs as object) } as Record<string, unknown> : {};
  const prevAddons =
    base.addons && typeof base.addons === "object" && !Array.isArray(base.addons)
      ? (base.addons as Record<string, unknown>)
      : {};
  base.addons = { ...prevAddons, ...patch };
  return base as Prisma.InputJsonValue;
}

async function reconcileSubscription(sub: Stripe.Subscription): Promise<void> {
  const businessId = sub.metadata?.businessId;
  if (!businessId) return;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, verificationBadge: true },
  });
  if (!business) return;

  const tier = tierFromSubscription(sub);
  const trainerSeats = trainerSeatsFromSubscription(sub);
  const status = statusFromStripe(sub.status);
  const paying = status === "ACTIVE" || status === "PAST_DUE";
  const currentPeriodEnd = sub.items?.data?.[0]?.current_period_end
    ? new Date(sub.items.data[0].current_period_end * 1000)
    : null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

  // Only raise the badge while the subscription is paying; never downgrade.
  const nextBadge = paying
    ? maxBadge(business.verificationBadge, TIER_BADGE[tier])
    : business.verificationBadge;

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        tier,
        trainerSeats,
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd,
      },
      update: {
        tier,
        trainerSeats,
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd,
      },
    }),
    prisma.business.update({
      where: { id: businessId },
      data: { verificationBadge: nextBadge },
    }),
    prisma.auditLog.create({
      data: {
        action: "SUBSCRIPTION_RECONCILED",
        entityType: "Business",
        entityId: businessId,
        performedBy: "stripe-webhook",
        details: { tier, status, stripeSubscriptionId: sub.id },
      },
    }),
  ]);
}

// A one-off "featured placement" purchase. Sets isFeatured + featuredUntil and
// records both the Purchase ledger row and the attributes.addons.featured flag.
async function reconcileFeaturedPurchase(
  businessId: string,
  paymentId: string,
  amount: number,
  durationDays: number,
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, attributes: true },
  });
  if (!business) return;

  const featuredUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  const attributes = mergeAddons(business.attributes, { featured: true });

  await prisma.$transaction([
    prisma.purchase.upsert({
      where: { stripePaymentId: paymentId },
      create: { businessId, product: "featured", stripePaymentId: paymentId, amount, expiresAt: featuredUntil },
      update: { amount, expiresAt: featuredUntil },
    }),
    prisma.business.update({
      where: { id: businessId },
      data: { isFeatured: true, featuredUntil, attributes },
    }),
    prisma.auditLog.create({
      data: {
        action: "FEATURED_PURCHASED",
        entityType: "Business",
        entityId: businessId,
        performedBy: "stripe-webhook",
        details: { paymentId, amount, featuredUntil: featuredUntil.toISOString() },
      },
    }),
  ]);
}

// A Spotlight add-on purchase: record the Purchase ledger row, then create the
// spotlight window via the shared grants layer (which enforces the per-city cap —
// windows beyond 3 active are queued — and writes the audit log).
async function reconcileSpotlightPurchase(
  businessId: string,
  paymentId: string,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const locationId = session.metadata?.spotlightLocationId;
  const weeks = Number(session.metadata?.spotlightWeeks);
  if (!locationId || !Number.isInteger(weeks) || weeks < 1) return;

  // Idempotency: if we already recorded this payment, do not create a 2nd window.
  const existing = await prisma.purchase.findUnique({
    where: { stripePaymentId: paymentId },
    select: { id: true },
  });
  if (existing) return;

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  const amount = session.amount_total ?? PRICES.spotlight.weekly * weeks;

  const purchase = await recordPurchase({
    businessId,
    product: "spotlight",
    amountCents: amount,
    stripePaymentId: paymentId,
    expiresAt: endsAt,
  });

  await createSpotlight({
    businessId,
    locationId,
    weeks,
    startsAt,
    purchaseId: purchase.id,
    performedBy: "stripe-webhook",
  });
}

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Billing is disabled" }, { status: 503 });
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await reconcileSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.metadata?.businessId ?? session.client_reference_id ?? undefined;
      if (session.mode === "subscription" && typeof session.subscription === "string") {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        if (businessId && !sub.metadata?.businessId) sub.metadata = { ...sub.metadata, businessId };
        await reconcileSubscription(sub);
      } else if (session.mode === "payment" && businessId) {
        const paymentId =
          typeof session.payment_intent === "string" ? session.payment_intent : session.id;
        if (session.metadata?.planKind === "spotlight") {
          // Spotlight add-on: create the window (cap-aware) + a Purchase row.
          await reconcileSpotlightPurchase(businessId, paymentId, session);
        } else {
          // One-off "featured placement". Duration via metadata, default 30d.
          const days = Number(session.metadata?.featuredDays ?? 30) || 30;
          await reconcileFeaturedPurchase(businessId, paymentId, session.amount_total ?? 0, days);
        }
      }
      break;
    }
    default:
      // Unhandled event types are acknowledged so Stripe stops retrying.
      break;
  }

  return NextResponse.json({ received: true });
}
