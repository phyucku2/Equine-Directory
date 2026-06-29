import { NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { requireBusinessOwner, AuthError } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/urls";
import { checkoutPlanFor, MissingPriceError, type PlanRequest } from "@/lib/billing/products";

// Starts a Stripe Checkout session for a business subscription or add-on.
// Inert in beta: `stripe` is null unless BILLING_ENABLED + a test-mode key, so
// the first line short-circuits with 503 and no Stripe call is ever made.
//
// This route NEVER writes paid state — it only opens a Checkout session. The
// webhook is the sole writer of Subscription / trainerSeats / Spotlight / Purchase.
//
// Two body shapes are accepted:
//   1) Plan-tab requests: { businessId, request: PlanRequest } — the monetization
//      ladder (verified/trainerSeat/events/spotlight). Resolved via products.ts.
//   2) Legacy/raw: { businessId, priceId, mode } — a single price id (kept for the
//      accounts-system add-ons that already pass a price id directly).

const SPOTLIGHT_MAX_WEEKS = 52;
const TRAINER_SEAT_MAX = 50;

// Mirror of the Plan route's validator so a client-supplied request can't smuggle
// out-of-range quantities into a Stripe line item.
function parsePlanRequest(raw: unknown): PlanRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const kind = body.kind;
  if (kind === "verified") {
    return { kind, cycle: body.cycle === "yearly" ? "yearly" : "monthly" };
  }
  if (kind === "trainerSeat") {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > TRAINER_SEAT_MAX) return null;
    return { kind, quantity };
  }
  if (kind === "events") return { kind };
  if (kind === "spotlight") {
    const locationId = typeof body.locationId === "string" ? body.locationId.trim() : "";
    const weeks = Number(body.weeks);
    if (!locationId) return null;
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > SPOTLIGHT_MAX_WEEKS) return null;
    return { kind, locationId, weeks };
  }
  return null;
}

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Billing is disabled" }, { status: 503 });
  }

  let body: {
    businessId?: string;
    priceId?: string;
    mode?: "subscription" | "payment";
    request?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const businessId = body.businessId?.trim();
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required." }, { status: 400 });
  }

  // Authorization: businessId comes from the body here, so it MUST be checked
  // against ownership (ADMIN bypasses) before we let Stripe attach it.
  try {
    await requireBusinessOwner(businessId);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, slug: true, email: true, subscription: { select: { stripeCustomerId: true } } },
  });
  if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  // Resolve line items + mode + metadata, either from a typed Plan request or
  // from a raw priceId. The webhook keys all paid state off this metadata.
  let mode: "subscription" | "payment";
  let lineItems: { price: string; quantity: number }[];
  let metadata: Record<string, string>;

  if (body.request !== undefined) {
    const req = parsePlanRequest(body.request);
    if (!req) return NextResponse.json({ error: "Invalid plan request." }, { status: 400 });
    try {
      const plan = checkoutPlanFor(business.id, req);
      mode = plan.mode;
      lineItems = plan.lineItems;
      // Stripe metadata values must be strings; drop undefined fields.
      metadata = Object.fromEntries(
        Object.entries(plan.metadata).filter(([, v]) => v !== undefined) as [string, string][],
      );
    } catch (err) {
      if (err instanceof MissingPriceError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      throw err;
    }
  } else {
    const priceId = body.priceId?.trim();
    if (!priceId) {
      return NextResponse.json({ error: "priceId or request is required." }, { status: 400 });
    }
    mode = body.mode === "payment" ? "payment" : "subscription";
    lineItems = [{ price: priceId, quantity: 1 }];
    metadata = { businessId: business.id };
  }

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: lineItems,
    customer: business.subscription?.stripeCustomerId ?? undefined,
    customer_email: business.subscription?.stripeCustomerId ? undefined : business.email ?? undefined,
    // The webhook keys all paid state off this metadata, never off client input.
    client_reference_id: business.id,
    metadata,
    subscription_data: mode === "subscription" ? { metadata } : undefined,
    payment_intent_data: mode === "payment" ? { metadata } : undefined,
    success_url: absoluteUrl(`/owner/${business.slug}/plan?billing=success`),
    cancel_url: absoluteUrl(`/owner/${business.slug}/plan?billing=cancel`),
  });

  return NextResponse.json({ url: session.url });
}
