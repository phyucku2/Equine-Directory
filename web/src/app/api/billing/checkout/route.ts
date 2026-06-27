import { NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { requireBusinessOwner, AuthError } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/urls";

// Starts a Stripe Checkout session for a business subscription or add-on.
// Inert in beta: `stripe` is null unless BILLING_ENABLED + a test-mode key, so
// the first line short-circuits with 503 and no Stripe call is ever made.
//
// This route NEVER writes paid state — it only opens a Checkout session. The
// webhook is the sole writer of Subscription / badge / isFeatured / addons.

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Billing is disabled" }, { status: 503 });
  }

  let body: { businessId?: string; priceId?: string; mode?: "subscription" | "payment" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const businessId = body.businessId?.trim();
  const priceId = body.priceId?.trim();
  const mode = body.mode === "payment" ? "payment" : "subscription";
  if (!businessId || !priceId) {
    return NextResponse.json({ error: "businessId and priceId are required." }, { status: 400 });
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

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    customer: business.subscription?.stripeCustomerId ?? undefined,
    customer_email: business.subscription?.stripeCustomerId ? undefined : business.email ?? undefined,
    // The webhook keys all paid state off this metadata, never off client input.
    client_reference_id: business.id,
    metadata: { businessId: business.id },
    subscription_data: mode === "subscription" ? { metadata: { businessId: business.id } } : undefined,
    payment_intent_data: mode === "payment" ? { metadata: { businessId: business.id } } : undefined,
    success_url: absoluteUrl(`/owner/${business.slug}/listing?billing=success`),
    cancel_url: absoluteUrl(`/owner/${business.slug}/listing?billing=cancel`),
  });

  return NextResponse.json({ url: session.url });
}
