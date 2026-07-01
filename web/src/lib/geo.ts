import { prisma } from "@/lib/prisma";

// Same normalization the rest of the codebase uses for slugs (see
// slugify() in src/lib/db/owner.ts) — duplicated here in minimal form to
// avoid pulling in that module's unrelated trainer/event exports.
function slugifyCityName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface VisitorGeo {
  lat: number;
  lng: number;
  source: "query" | "header-precise" | "header-city";
}

// Resolves a visitor's approximate coordinates for the "near you" homepage
// sections and the /api/nearby* endpoints, in priority order:
//
//   1. `lat`/`lng` query params — the explicit browser-geolocation override
//      used by NearbyStables.tsx / NearbyCities.tsx once the user's browser
//      grants permission.
//   2. Vercel's precise edge geo headers, x-vercel-ip-latitude /
//      x-vercel-ip-longitude.
//   3. A DB lookup keyed on the broadly-available x-vercel-ip-city /
//      x-vercel-ip-country-region / x-vercel-ip-country headers.
//
// IMPORTANT: x-vercel-ip-latitude/longitude are NOT guaranteed on the
// Hobby/free Vercel plan — only city/country/region headers are broadly
// available there. So layer 3 (city lookup) is the primary real-world path
// for most production visitors; layers 1-2 are opportunistic upgrades when
// available (browser geolocation, or a paid plan / precise headers).
export async function resolveVisitorGeo(
  request: Request,
): Promise<VisitorGeo | null> {
  const { searchParams } = new URL(request.url);

  // 1. Explicit browser-geolocation override via query params.
  // IMPORTANT: searchParams.get()/headers.get() return null when absent, and
  // Number(null) === 0 (a *finite* number!). The old code did
  // `Number(searchParams.get("lat"))` then `Number.isFinite(...)`, so every
  // param-less call resolved to (0,0) source:"query" — the null island off
  // Africa — and short-circuited the header fallbacks (no barn is within 250km
  // of (0,0), so every "near you" query came back empty). Guard by requiring the
  // raw values to actually be present before Number()-ing.
  const rawQLat = searchParams.get("lat");
  const rawQLng = searchParams.get("lng");
  if (rawQLat && rawQLng) {
    const queryLat = Number(rawQLat);
    const queryLng = Number(rawQLng);
    if (Number.isFinite(queryLat) && Number.isFinite(queryLng)) {
      return { lat: queryLat, lng: queryLng, source: "query" };
    }
  }

  // 2. Vercel's precise edge geo headers (same Number(null)===0 trap — these are
  //    absent on the Hobby plan, so this must not falsely match at (0,0)).
  const rawHLat = request.headers.get("x-vercel-ip-latitude");
  const rawHLng = request.headers.get("x-vercel-ip-longitude");
  if (rawHLat && rawHLng) {
    const headerLat = Number(rawHLat);
    const headerLng = Number(rawHLng);
    if (Number.isFinite(headerLat) && Number.isFinite(headerLng)) {
      return { lat: headerLat, lng: headerLng, source: "header-precise" };
    }
  }

  // 3. City/region headers → Location table lookup (the Hobby-plan path).
  const rawCity = request.headers.get("x-vercel-ip-city");
  const regionRaw = request.headers.get("x-vercel-ip-country-region");
  // x-vercel-ip-country is available for future disambiguation (e.g.
  // non-US region codes) but the current STATE hierarchy is US-only.
  const country = request.headers.get("x-vercel-ip-country");
  if (!rawCity || !regionRaw || !country) return null;
  // Vercel may send the region as ISO 3166-2 ("US-FL") or bare ("FL") depending
  // on plan/edge — normalize to the bare state code our Location.code stores.
  const regionCode = regionRaw.includes("-") ? regionRaw.split("-").pop()! : regionRaw;

  let decodedCity: string;
  try {
    decodedCity = decodeURIComponent(rawCity);
  } catch {
    decodedCity = rawCity;
  }
  const citySlug = slugifyCityName(decodedCity);
  if (!citySlug) return null;

  const city = await prisma.location.findFirst({
    where: {
      type: "CITY",
      slug: citySlug,
      latitude: { not: null },
      longitude: { not: null },
      parent: { is: { parent: { is: { code: regionCode } } } },
    },
    select: { latitude: true, longitude: true },
  });

  if (!city || city.latitude == null || city.longitude == null) return null;

  return { lat: city.latitude, lng: city.longitude, source: "header-city" };
}
