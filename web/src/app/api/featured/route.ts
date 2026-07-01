import { NextResponse } from "next/server";
import { getFeaturedNearby } from "@/lib/db/nearby";
import { getFeatured } from "@/lib/db/business";
import { resolveVisitorGeo } from "@/lib/geo";

export const dynamic = "force-dynamic";

// GET /api/featured[?lat=&lng=] — LOCAL featured stables for the visitor: paid /
// spotlight / hand-picked barns in their area first, then the best local barns
// to fill (see getFeaturedNearby). Falls back to the national top-rated set when
// we can't resolve a location or nothing is nearby, so the homepage section is
// never empty. `scope` tells the client whether it got local or national data.
export async function GET(request: Request) {
  const geo = await resolveVisitorGeo(request);
  if (geo) {
    const local = await getFeaturedNearby(geo.lat, geo.lng, 6);
    if (local.length > 0) {
      return NextResponse.json(
        { items: local, scope: "local" },
        { headers: { "Cache-Control": "private, max-age=300" } },
      );
    }
  }
  const national = await getFeatured(6);
  return NextResponse.json(
    { items: national, scope: "national" },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
