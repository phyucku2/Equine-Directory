import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import type { Prisma, SubTier, SubStatus, VerificationBadge } from "@prisma/client";

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
};

const BADGE_RANK: Record<VerificationBadge, number> = {
  UNVERIFIED: 0,
  VERIFIED: 1,
  TRUSTED: 2,
  PREMIUM: 3,
};

// Map a Stripe subscription to our tier. We read it from the price's lookup_key
// (e.g. "pro" / "premium") falling back to subscription metadata `tier`.
function tierFromSubscription(sub: Stripe.Subscription): SubTier {
  const item = sub.items?.data?.[0];
  const lookup = item?.price?.lookup_key?.toUpperCase();
  const metaTier = (sub.metadata?.tier ?? "").toUpperCase();
  const candidate = lookup || metaTier;
  if (candidate === "PREMIUM") return "PREMIUM";
  if (candidate === "PRO") return "PRO";
  return "FREE";
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
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd,
      },
      update: {
        tier,
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
        // One-off add-on (featured placement). Duration via metadata, default 30d.
        const days = Number(session.metadata?.featuredDays ?? 30) || 30;
        const paymentId =
          typeof session.payment_intent === "string" ? session.payment_intent : session.id;
        await reconcileFeaturedPurchase(businessId, paymentId, session.amount_total ?? 0, days);
      }
      break;
    }
    default:
      // Unhandled event types are acknowledged so Stripe stops retrying.
      break;
  }

  return NextResponse.json({ received: true });
}
