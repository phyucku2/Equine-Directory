import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { requireEntitlement } from "@/lib/auth/owner-entitlement";
import { setStallsBadge } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// PATCH /api/owner/businesses/[id]/stalls-badge — toggle the "Stalls Available"
// badge overlay (stored in Business.attributes.stallsBadge). Gated behind the
// stallsBadge entitlement (VERIFIED+); the public overlay only renders when the
// flag is on AND the business is entitled. Body: { on: boolean }.
export const PATCH = withOwner(async ({ id, request }) => {
  const gate = await requireEntitlement(
    id,
    (e) => e.stallsBadge,
    "The Stalls Available badge requires the Verified plan.",
  );
  if (gate.blocked) return gate.response;

  let body: { on?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof body.on !== "boolean") {
    return NextResponse.json({ error: "on must be a boolean." }, { status: 400 });
  }

  const result = await setStallsBadge(id, body.on);
  return NextResponse.json({ ok: true, stallsBadge: body.on, id: result.id });
});
