import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { requireEntitlement } from "@/lib/auth/owner-entitlement";
import { updateBoarding, toCount, toAcreage } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// PUT /api/owner/businesses/[id]/boarding — Boarding & Pricing tab. Writes
// boardTypes (validated against vocab), the access-policy slugs, the numeric
// facets (spotsAvailable/stallCount/acreage), and the per-board-type pricing
// JSON. priceFrom is derived server-side from pricing[].from. Touched facet keys
// (boardTypes, policies, pricing) are appended to ownerEditedFacets.
export const PUT = withOwner(async ({ id, request }) => {
  const gate = await requireEntitlement(
    id,
    (e) => e.canEditFacets,
    "Editing facets requires the Verified plan.",
  );
  if (gate.blocked) return gate.response;

  let body: {
    boardTypes?: unknown;
    policies?: unknown;
    spotsAvailable?: unknown;
    stallCount?: unknown;
    acreage?: unknown;
    pricing?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.boardTypes !== undefined && !Array.isArray(body.boardTypes)) {
    return NextResponse.json({ error: "boardTypes must be an array." }, { status: 400 });
  }
  if (body.policies !== undefined && !Array.isArray(body.policies)) {
    return NextResponse.json({ error: "policies must be an array." }, { status: 400 });
  }
  if (
    body.pricing !== undefined &&
    body.pricing !== null &&
    (typeof body.pricing !== "object" || Array.isArray(body.pricing))
  ) {
    return NextResponse.json({ error: "pricing must be an object." }, { status: 400 });
  }

  const result = await updateBoarding(id, {
    boardTypes: Array.isArray(body.boardTypes) ? (body.boardTypes as string[]) : [],
    policies: Array.isArray(body.policies) ? (body.policies as string[]) : [],
    spotsAvailable: toCount(body.spotsAvailable),
    stallCount: toCount(body.stallCount),
    acreage: toAcreage(body.acreage),
    pricing: body.pricing ?? {},
  });

  return NextResponse.json({ ok: true, ...result });
});
