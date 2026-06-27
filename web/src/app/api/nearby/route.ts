import { NextResponse } from "next/server";
import { getNearbyStables } from "@/lib/db/nearby";

export const dynamic = "force-dynamic";

// GET /api/nearby[?lat=&lng=] — nearest stables to the visitor.
// Precise coords via query params (browser geolocation) take priority; otherwise
// fall back to Vercel's edge geo headers (approximate, no permission prompt).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  let lat = Number(searchParams.get("lat"));
  let lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = Number(request.headers.get("x-vercel-ip-latitude"));
    lng = Number(request.headers.get("x-vercel-ip-longitude"));
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ items: [] });
  }

  const items = await getNearbyStables(lat, lng, 6);
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
