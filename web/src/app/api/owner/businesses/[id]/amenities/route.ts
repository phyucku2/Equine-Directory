import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { replaceAmenities } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

const MAX_AMENITIES = 40;
const MAX_LEN = 60;

// PUT /api/owner/businesses/[id]/amenities — full replace of Business.amenities.
// These render as chips on the public StableCard and detail page.
export const PUT = withOwner(async ({ id, request }) => {
  let body: { amenities?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!Array.isArray(body.amenities)) {
    return NextResponse.json({ error: "amenities must be an array." }, { status: 400 });
  }

  // Normalize: trim, drop empties, cap length, dedupe (case-insensitive), cap count.
  const seen = new Set<string>();
  const amenities: string[] = [];
  for (const raw of body.amenities) {
    if (typeof raw !== "string") continue;
    const a = raw.trim().slice(0, MAX_LEN);
    if (!a) continue;
    const key = a.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    amenities.push(a);
    if (amenities.length >= MAX_AMENITIES) break;
  }

  const result = await replaceAmenities(id, amenities);
  return NextResponse.json({ ok: true, amenities: result.amenities });
});
