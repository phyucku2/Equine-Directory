import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { updateFacility } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// PUT /api/owner/businesses/[id]/facility — Facility & Security tab. Writes the
// expanded amenities vocab, securityFeatures, and policies (all validated
// against vocab). The open/closed-barn trainer-policy slugs are owned by the
// Disciplines tab and preserved server-side. Touched keys are appended to
// ownerEditedFacets.
export const PUT = withOwner(async ({ id, request }) => {
  let body: { amenities?: unknown; securityFeatures?: unknown; policies?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  for (const k of ["amenities", "securityFeatures", "policies"] as const) {
    if (body[k] !== undefined && !Array.isArray(body[k])) {
      return NextResponse.json({ error: `${k} must be an array.` }, { status: 400 });
    }
  }

  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  const result = await updateFacility(id, {
    amenities: arr(body.amenities),
    securityFeatures: arr(body.securityFeatures),
    policies: arr(body.policies),
  });

  return NextResponse.json({ ok: true, ...result });
});
