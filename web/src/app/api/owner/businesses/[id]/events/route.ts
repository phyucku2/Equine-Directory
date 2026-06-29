import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { requireEntitlement } from "@/lib/auth/owner-entitlement";
import { listEvents, createEvent } from "@/lib/db/owner";
import { parseEvent } from "./_validate";

export const dynamic = "force-dynamic";

// GET /api/owner/businesses/[id]/events — list a business's events.
export const GET = withOwner(async ({ id }) => {
  const events = await listEvents(id);
  return NextResponse.json({ ok: true, events });
});

// POST /api/owner/businesses/[id]/events — create an event. Publishing requires
// the EVENTS tier (canEvents).
export const POST = withOwner(async ({ id, request }) => {
  const gate = await requireEntitlement(id, (e) => e.canEvents, "Publishing events requires the Events plan.");
  if (gate.blocked) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = parseEvent(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const event = await createEvent(id, parsed.data);
  return NextResponse.json({ ok: true, event });
});
