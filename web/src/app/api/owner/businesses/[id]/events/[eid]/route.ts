import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { requireEntitlement } from "@/lib/auth/owner-entitlement";
import { updateEvent, deleteEvent } from "@/lib/db/owner";
import { parseEvent } from "../_validate";

export const dynamic = "force-dynamic";

// PATCH /api/owner/businesses/[id]/events/[eid] — edit an event. Publishing
// requires the EVENTS tier (canEvents).
export const PATCH = withOwner<{ id: string; eid: string }>(async ({ id, request, params }) => {
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

  const event = await updateEvent(id, params.eid, parsed.data);
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ ok: true, event });
});

// DELETE /api/owner/businesses/[id]/events/[eid] — remove an event.
export const DELETE = withOwner<{ id: string; eid: string }>(async ({ id, params }) => {
  const removed = await deleteEvent(id, params.eid);
  if (!removed) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
});
