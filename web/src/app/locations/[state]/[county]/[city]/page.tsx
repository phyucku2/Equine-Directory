import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCityBySlug } from "@/lib/db/location";
import { getByLocation, countByLocation } from "@/lib/db/business";
import { countyUrl, cityUrl, stateUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BusinessCard } from "@/components/business/BusinessCard";
import { FeaturedSpotlights } from "@/components/business/FeaturedSpotlights";
import { getActiveSpotlightsForLocation } from "@/lib/db/spotlight";
import { Pagination } from "@/components/Pagination";
import { NearbyCityLinks } from "@/components/NearbyCityLinks";
import { robots, isHubIndexable } from "@/lib/seo/indexing";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; county: string; city: string }>;
}): Promise<Metadata> {
  const { state, county, city } = await params;
  const loc = await getCityBySlug(state, county, city);
  if (!loc) return { title: "City not found" };
  const count = await countByLocation(loc.id);
  // "City, ST" matches how people actually search local queries; fall back to
  // the full state name when a code isn't seeded.
  const stateLoc = loc.parent?.parent;
  const st = stateLoc?.code ?? stateLoc?.name ?? "";
  return {
    title: `Horse Stables in ${loc.name}${st ? `, ${st}` : ""}`,
    description: `Find horse stables and barns in ${loc.name}${stateLoc ? `, ${stateLoc.name}` : ""} — boarding, training, and facilities near you.`,
    robots: robots(isHubIndexable(count)),
    alternates: { canonical: absoluteUrl(cityUrl(state, county, city)) },
  };
}

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Promise<{ state: string; county: string; city: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { state, county, city } = await params;
  const { page: pageParam } = await searchParams;
  const loc = await getCityBySlug(state, county, city);
  if (!loc) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const [results, spotlights] = await Promise.all([
    getByLocation(loc.id, page),
    // Featured slot only on the first page (it's an above-the-fold placement).
    page === 1 ? getActiveSpotlightsForLocation(loc.id) : Promise.resolve([]),
  ]);
  const countyLoc = loc.parent;
  const stateLoc = countyLoc?.parent;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          ...(stateLoc ? [{ name: stateLoc.name, url: stateUrl(state) }] : []),
          ...(countyLoc ? [{ name: countyLoc.name, url: countyUrl(state, county) }] : []),
          { name: loc.name, url: cityUrl(state, county, city) },
        ]}
      />
      <h1 className="mt-4 text-3xl font-semibold text-pine">
        Horse stables in {loc.name}
        {stateLoc?.code ? `, ${stateLoc.code}` : ""}
      </h1>
      <p className="mt-1 text-ink/55">
        {results.total} {results.total === 1 ? "stable" : "stables"} · Updated {new Date().getFullYear()}
      </p>

      <FeaturedSpotlights spotlights={spotlights} title={`Featured stables in ${loc.name}`} />

      {results.items.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center text-ink/55">
          No stables here yet. We&apos;re actively adding Florida stables — check back soon.
        </p>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.items.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
          <Pagination basePath={cityUrl(state, county, city)} page={results.page} totalPages={results.totalPages} />
        </>
      )}

      {/* Lateral local links — the internal mesh Google follows between cities */}
      <NearbyCityLinks
        lat={loc.latitude}
        lng={loc.longitude}
        excludeCitySlug={loc.slug}
        heading={`Stables in cities near ${loc.name}`}
      />
    </div>
  );
}
