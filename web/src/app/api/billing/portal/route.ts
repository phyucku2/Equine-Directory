import { NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { requireBusinessOwner, AuthError } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/urls";

// Opens the Stripe billing portal for a business's existing customer so the owner
// can manage / cancel their subscription. Inert in beta (503 when !stripe).
// Read-only with respect to OUR DB — the webhook reflects any portal changes.

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Billing is disabled" }, { status: 503 });
  }

  let body: { businessId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const businessId = body.businessId?.trim();
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required." }, { status: 400 });
  }

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
    select: { slug: true, subscription: { select: { stripeCustomerId: true } } },
  });
  const customerId = business?.subscription?.stripeCustomerId;
  if (!business || !customerId) {
    return NextResponse.json({ error: "No billing account for this business." }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: absoluteUrl(`/owner/${business.slug}/listing`),
  });

  return NextResponse.json({ url: session.url });
}
