import { NextResponse } from "next/server";
import { resolveVisitorGeo } from "@/lib/geo";

export const dynamic = "force-dynamic";

// GET /api/geo — IP-approximate visitor location, for client components (like
// the map) that can't read request headers directly. Mirrors /api/nearby's
// style; delegates all header-parsing/fallback logic to the shared geo helper.
//
// GET /api/geo?debug=1 — diagnostics: echoes the raw Vercel edge geo headers
// this request carried alongside the resolved result, so we can see exactly why
// resolution succeeds/fails on the current plan (missing precise coords, a
// region code like "US-FL" vs "FL", or a city not seeded in Location). No PII
// beyond the caller's own approximate location; not cached.
export async function GET(request: Request) {
  const geo = await resolveVisitorGeo(request);

  const { searchParams } = new URL(request.url);
  if (searchParams.get("debug") === "1") {
    const h = request.headers;
    return NextResponse.json(
      {
        resolved: geo,
        headers: {
          city: h.get("x-vercel-ip-city"),
          region: h.get("x-vercel-ip-country-region"),
          country: h.get("x-vercel-ip-country"),
          latitude: h.get("x-vercel-ip-latitude"),
          longitude: h.get("x-vercel-ip-longitude"),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(geo ?? null, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
