import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { requireEntitlement } from "@/lib/auth/owner-entitlement";
import { listTrainers, countTrainers, createTrainer } from "@/lib/db/owner";
import { parseTrainer } from "./_validate";

export const dynamic = "force-dynamic";

// GET /api/owner/businesses/[id]/trainers — list trainer profiles + seat usage.
export const GET = withOwner(async ({ id }) => {
  const gate = await requireEntitlement(id, (e) => e.maxTrainers > 0, "Trainer profiles require the Team plan.");
  const trainers = await listTrainers(id);
  return NextResponse.json({
    ok: true,
    trainers,
    maxTrainers: gate.blocked ? 0 : gate.entitlements.maxTrainers,
  });
});

// POST /api/owner/businesses/[id]/trainers — create a trainer. Gated by the
// maxTrainers entitlement (TEAM: 2 + subscription.trainerSeats); rejected at the
// cap with an add-a-seat / upgrade prompt.
export const POST = withOwner(async ({ id, request }) => {
  const gate = await requireEntitlement(id, (e) => e.maxTrainers > 0, "Trainer profiles require the Team plan.");
  if (gate.blocked) return gate.response;

  const used = await countTrainers(id);
  if (used >= gate.entitlements.maxTrainers) {
    return NextResponse.json(
      {
        error: `You've used all ${gate.entitlements.maxTrainers} trainer seats. Add a seat to invite more.`,
        upgradeRequired: true,
      },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = parseTrainer(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const trainer = await createTrainer(id, parsed.data);
  return NextResponse.json({ ok: true, trainer });
});
