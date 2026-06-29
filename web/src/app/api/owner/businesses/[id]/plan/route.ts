import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withOwner } from "@/lib/auth/owner-route";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/db/notification";
import { BILLING_ENABLED } from "@/lib/billing/beta";
import { PRICES } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

// What an owner can request / buy from the Plan tab.
type PlanRequest =
  | { kind: "verified"; cycle: "monthly" | "yearly" }
  | { kind: "trainerSeat"; quantity: number }
  | { kind: "events" }
  | { kind: "spotlight"; locationId: string; weeks: number };

const SPOTLIGHT_MAX_WEEKS = 52;
const TRAINER_SEAT_MAX = 50;

function parse(body: Record<string, unknown>): PlanRequest | null {
  const kind = body.kind;
  if (kind === "verified") {
    const cycle = body.cycle === "yearly" ? "yearly" : "monthly";
    return { kind, cycle };
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

// Human-readable label + estimated total (cents) for a request, used in both the
// admin notification (beta) and the Stripe wiring (stage 4).
function describe(req: PlanRequest): { label: string; amountCents: number } {
  switch (req.kind) {
    case "verified":
      return {
        label: `Verified plan (${req.cycle})`,
        amountCents: req.cycle === "yearly" ? PRICES.verified.yearly : PRICES.verified.monthly,
      };
    case "trainerSeat":
      return {
        label: `${req.quantity} trainer seat(s)`,
        amountCents: PRICES.trainerSeat.yearly * req.quantity,
      };
    case "events":
      return { label: "Events plan", amountCents: PRICES.events.yearly };
    case "spotlight":
      return {
        label: `Spotlight · ${req.weeks} week(s)`,
        amountCents: PRICES.spotlight.weekly * req.weeks,
      };
  }
}

// POST /api/owner/businesses/[id]/plan — request a tier change / add-on.
//
// In beta (BILLING_ENABLED off) this is the "Request access" path: it files an
// in-app SYSTEM notification to every admin (who manually grants the tier/seats/
// spotlight). When billing is on, the Plan UI talks to /api/billing/checkout
// directly (stage 4 owns the Stripe price IDs); this route returns a hint so the
// client knows to start checkout instead.
export const POST = withOwner(async ({ id, request, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const req = parse(body);
  if (!req) return NextResponse.json({ error: "Invalid plan request." }, { status: 400 });

  const { label, amountCents } = describe(req);

  if (BILLING_ENABLED) {
    // Billing is live: the client should open Stripe Checkout (stage 4 maps each
    // request kind to a Stripe price). We don't write paid state here.
    return NextResponse.json({ ok: true, checkout: true, request: req, label, amountCents });
  }

  // Beta: notify admins to manually grant. Capture who/what for the admin queue.
  const business = await prisma.business.findUnique({
    where: { id },
    select: { name: true, slug: true },
  });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(
    admins.map((a) =>
      createNotification({
        userId: a.id,
        type: "SYSTEM",
        title: `Plan access request: ${label}`,
        body: `${user.name ?? user.email ?? "An owner"} requested "${label}" for ${business?.name ?? id}.`,
        url: business ? `/admin` : null,
        data: { businessId: id, request: req, requestedBy: user.id } as Prisma.InputJsonValue,
      }),
    ),
  );

  return NextResponse.json({
    ok: true,
    requested: true,
    label,
    message: "Thanks! We'll review your request and enable this on your account shortly.",
  });
});
