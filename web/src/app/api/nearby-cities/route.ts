import { NextResponse } from "next/server";
import { getNearbyCities } from "@/lib/db/nearby";

export const dynamic = "force-dynamic";

// GET /api/nearby-cities[?lat=&lng=] — cities with stables nearest the visitor,
// for the geo-localized homepage city list. Precise coords via query params
// (browser geolocation) take priority; otherwise fall back to Vercel's edge geo
// headers (approximate, no permission prompt). See post-launch-fixes.md §1.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  let lat = Number(searchParams.get("lat"));
  let lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = Number(request.headers.get("x-vercel-ip-latitude"));
    lng = Number(request.headers.get("x-vercel-ip-longitude"));
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ cities: [] });
  }

  const cities = await getNearbyCities(lat, lng, 6);
  return NextResponse.json(
    { cities },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
