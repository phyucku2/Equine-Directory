import { NextResponse } from "next/server";
import { resolveVisitorGeo } from "@/lib/geo";
import { geoSearchBusinesses } from "@/lib/db/search";
import { matchSegment } from "@/lib/catalog";

export const dynamic = "force-dynamic";

// GET /api/nearby-search?q=&category=[&lat=&lng=]
// Powers the "near me" search intent (see src/lib/geo-intent.ts). Precise
// browser coords via lat/lng win; otherwise resolveVisitorGeo falls back to
// Vercel edge geo / IP-city — the same ladder the homepage "near you" rails use.
// `q` is the residual service term ("horseback riding"); we map it to a category
// when we can (so a trail-ride barn not literally named "horseback riding" still
// surfaces), else fall back to a keyword filter.
export async function GET(request: Request) {
  const geo = await resolveVisitorGeo(request);
  if (!geo) return NextResponse.json({ items: [], geo: null });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const explicitCategory = searchParams.get("category") ?? undefined;

  // Prefer an explicit category filter; otherwise infer one from the query.
  const segment = explicitCategory ? undefined : matchSegment(q);
  const categorySlugs = explicitCategory
    ? [explicitCategory]
    : segment?.slugs;
  // Only keep the keyword filter when we couldn't resolve a category from it —
  // once "farrier near me" maps to the farrier category, the word "farrier"
  // would just narrow it redundantly (and drop barns whose name omits it).
  const keyword = explicitCategory || segment ? undefined : q || undefined;

  const items = await geoSearchBusinesses(geo.lat, geo.lng, {
    categorySlugs,
    q: keyword,
    take: 48,
  });

  return NextResponse.json(
    { items, geo: { source: geo.source } },
    { headers: { "Cache-Control": "private, max-age=120" } },
  );
}
