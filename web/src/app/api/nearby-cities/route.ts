import { NextResponse } from "next/server";
import { getNearbyCities } from "@/lib/db/nearby";
import { resolveVisitorGeo } from "@/lib/geo";

export const dynamic = "force-dynamic";

// GET /api/nearby-cities[?lat=&lng=] — cities with stables nearest the visitor,
// for the geo-localized homepage city list. Precise coords via query params
// (browser geolocation) take priority; otherwise fall back to Vercel's edge geo
// headers, or a DB lookup from the visitor's city/region headers. See
// resolveVisitorGeo() in src/lib/geo.ts and post-launch-fixes.md §1.
export async function GET(request: Request) {
  const geo = await resolveVisitorGeo(request);
  if (!geo) return NextResponse.json({ cities: [] });

  const cities = await getNearbyCities(geo.lat, geo.lng, 6);
  return NextResponse.json(
    { cities },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
