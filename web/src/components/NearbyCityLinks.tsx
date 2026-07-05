import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getNearbyCities } from "@/lib/db/nearby";
import { cityUrl, intentUrl } from "@/lib/urls";

// Crawlable nearby-city link block for local SEO (server component). Cities are
// resolved by real distance from the current city's coordinates, so every city
// page links laterally into its neighbors — the internal-linking mesh Google
// uses to discover and rank localized pages. When `categorySlug` is given the
// links target the same category's intent page in each neighbor city.
//
// Location rows in production frequently have NULL coordinates (the crawler
// creates cities without them), so when they're missing we fall back to the
// centroid of the city's own published listings.
export async function NearbyCityLinks({
  lat,
  lng,
  locationId,
  excludeCitySlug,
  categorySlug,
  heading,
}: {
  lat: number | null;
  lng: number | null;
  /** Location id, used to derive a listing-centroid when lat/lng are null. */
  locationId: string;
  excludeCitySlug: string;
  /** Link to /[category]/... intent pages instead of the generic city hubs. */
  categorySlug?: string;
  heading: string;
}) {
  let cities;
  try {
    if (lat == null || lng == null) {
      const centroid = await prisma.business.aggregate({
        _avg: { latitude: true, longitude: true },
        where: { locationId, isPublished: true },
      });
      lat = centroid._avg.latitude;
      lng = centroid._avg.longitude;
    }
    if (lat == null || lng == null) return null;
    cities = await getNearbyCities(lat, lng, 9);
  } catch {
    return null; // degraded DB — the block is an enhancement, never a blocker
  }
  const neighbors = cities.filter(
    (c) => c.citySlug !== excludeCitySlug && c.stateSlug,
  );
  if (neighbors.length === 0) return null;

  return (
    <nav aria-label={heading} className="mt-12 rounded-2xl border border-leather/15 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/55">{heading}</h2>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {neighbors.map((c) => (
          <li key={c.citySlug}>
            <Link
              href={
                categorySlug
                  ? intentUrl(categorySlug, c.stateSlug!, c.citySlug)
                  : cityUrl(c.stateSlug!, c.citySlug)
              }
              className="text-brass hover:underline"
            >
              {c.name}
              <span className="text-ink/40"> ({c.barnCount})</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
