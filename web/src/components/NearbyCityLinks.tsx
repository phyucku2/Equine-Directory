import Link from "next/link";
import { getNearbyCities } from "@/lib/db/nearby";
import { cityUrl, intentUrl } from "@/lib/urls";

// Crawlable nearby-city link block for local SEO (server component). Cities are
// resolved by real distance from the current city's coordinates, so every city
// page links laterally into its neighbors — the internal-linking mesh Google
// uses to discover and rank localized pages. When `categorySlug` is given the
// links target the same category's intent page in each neighbor city.
export async function NearbyCityLinks({
  lat,
  lng,
  excludeCitySlug,
  categorySlug,
  heading,
}: {
  lat: number | null;
  lng: number | null;
  excludeCitySlug: string;
  /** Link to /[category]/... intent pages instead of the generic city hubs. */
  categorySlug?: string;
  heading: string;
}) {
  if (lat == null || lng == null) return null;
  let cities;
  try {
    cities = await getNearbyCities(lat, lng, 9);
  } catch {
    return null; // degraded DB — the block is an enhancement, never a blocker
  }
  const neighbors = cities.filter(
    (c) => c.citySlug !== excludeCitySlug && c.countySlug && c.stateSlug,
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
                  ? intentUrl(categorySlug, c.stateSlug!, c.countySlug!, c.citySlug)
                  : cityUrl(c.stateSlug!, c.countySlug!, c.citySlug)
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
