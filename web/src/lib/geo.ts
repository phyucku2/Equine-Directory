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

  const queryLat = Number(searchParams.get("lat"));
  const queryLng = Number(searchParams.get("lng"));
  if (Number.isFinite(queryLat) && Number.isFinite(queryLng)) {
    return { lat: queryLat, lng: queryLng, source: "query" };
  }

  const headerLat = Number(request.headers.get("x-vercel-ip-latitude"));
  const headerLng = Number(request.headers.get("x-vercel-ip-longitude"));
  if (Number.isFinite(headerLat) && Number.isFinite(headerLng)) {
    return { lat: headerLat, lng: headerLng, source: "header-precise" };
  }

  const rawCity = request.headers.get("x-vercel-ip-city");
  const regionCode = request.headers.get("x-vercel-ip-country-region");
  // x-vercel-ip-country is available for future disambiguation (e.g.
  // non-US region codes) but the current STATE hierarchy is US-only.
  const country = request.headers.get("x-vercel-ip-country");
  if (!rawCity || !regionCode || !country) return null;

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
