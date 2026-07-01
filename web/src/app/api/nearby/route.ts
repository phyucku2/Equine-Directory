import { NextResponse } from "next/server";
import { getNearbyStables } from "@/lib/db/nearby";
import { resolveVisitorGeo } from "@/lib/geo";

export const dynamic = "force-dynamic";

// GET /api/nearby[?lat=&lng=] — nearest stables to the visitor.
// Precise coords via query params (browser geolocation) take priority; otherwise
// fall back to Vercel's edge geo headers, or a DB lookup from the visitor's
// city/region headers. See resolveVisitorGeo() in src/lib/geo.ts.
export async function GET(request: Request) {
  const geo = await resolveVisitorGeo(request);
  if (!geo) return NextResponse.json({ items: [] });

  const items = await getNearbyStables(geo.lat, geo.lng, 6);
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
