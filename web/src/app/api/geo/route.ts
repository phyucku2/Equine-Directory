import { NextResponse } from "next/server";
import { resolveVisitorGeo } from "@/lib/geo";

export const dynamic = "force-dynamic";

// GET /api/geo — IP-approximate visitor location, for client components (like
// the map) that can't read request headers directly. Mirrors /api/nearby's
// style; delegates all header-parsing/fallback logic to the shared geo helper.
export async function GET(request: Request) {
  const geo = await resolveVisitorGeo(request);
  return NextResponse.json(geo ?? null, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
