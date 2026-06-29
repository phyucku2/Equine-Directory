import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { updatePrograms } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// PUT /api/owner/businesses/[id]/programs — Programs & Camps tab. Full replace of
// the programs JSON list. Each entry's shape is validated server-side
// (sanitizePrograms): type must be a valid PROGRAM_TYPES slug, name is required,
// season/ageRange are capped strings, price/capacity are non-negative ints.
// "programs" is appended to ownerEditedFacets.
export const PUT = withOwner(async ({ id, request }) => {
  let body: { programs?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.programs !== undefined && !Array.isArray(body.programs)) {
    return NextResponse.json({ error: "programs must be an array." }, { status: 400 });
  }

  // sanitizePrograms (inside updatePrograms) accepts unknown and validates each
  // entry, dropping invalid ones.
  const result = await updatePrograms(id, body.programs ?? []);
  return NextResponse.json({ ok: true, ...result });
});
