import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { updateOffering, isOffering, OFFERINGS } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// PATCH /api/owner/businesses/[id]/offering — write the card-driving offering +
// priceFrom into Business.attributes. The merge happens server-side inside the
// write transaction (see updateOffering): DB attributes are re-read, the client
// blob is NOT trusted, googleMapsUri is preserved, and billing `addons` are
// stripped. offering is constrained to OFFERINGS; priceFrom is a positive number
// or null (to clear).
export const PATCH = withOwner(async ({ id, request }) => {
  let body: { offering?: unknown; priceFrom?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isOffering(body.offering)) {
    return NextResponse.json(
      { error: `offering must be one of: ${OFFERINGS.join(", ")}` },
      { status: 400 },
    );
  }

  let priceFrom: number | null = null;
  if (body.priceFrom !== undefined && body.priceFrom !== null && body.priceFrom !== "") {
    const n = Number(body.priceFrom);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "priceFrom must be a positive number." }, { status: 400 });
    }
    priceFrom = Math.round(n);
  }

  const result = await updateOffering(id, body.offering, priceFrom);
  return NextResponse.json({ ok: true, attributes: result.attributes });
});
