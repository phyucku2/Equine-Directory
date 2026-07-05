import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPlaceBySlug, getChildren, type ResolvedPlace } from "@/lib/db/location";
import { getByLocation, countByLocation } from "@/lib/db/business";
import { countyUrl, cityUrl, stateUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BusinessCard } from "@/components/business/BusinessCard";
import { FeaturedSpotlights } from "@/components/business/FeaturedSpotlights";
import { NearbyCityLinks } from "@/components/NearbyCityLinks";
import { getActiveSpotlightsForArea } from "@/lib/db/spotlight";
import { Pagination } from "@/components/Pagination";
import { robots, isHubIndexable } from "@/lib/seo/indexing";

export const revalidate = 86400;

// Flat `/locations/[state]/[place]` hub. `place` resolves to a CITY (preferred)
// or a COUNTY — one route serves both since cities were flattened up to the
// county level (Zillow-model URLs). City = listing grid; county = its cities +
// listing grid.
type Params = { state: string; place: string };

function stateInfo(resolved: ResolvedPlace) {
  if (resolved.kind === "city") {
    const county = resolved.loc.parent;
    const state = county?.parent;
    return { state, county };
  }
  return { state: resolved.loc.parent, county: null };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { state, place } = await params;
  const resolved = await getPlaceBySlug(state, place);
  if (!resolved) return { title: "Not found" };
  const count = await countByLocation(resolved.loc.id);
  const st = stateInfo(resolved).state;
  const stLabel = st?.code ?? st?.name ?? "";
  const where = stLabel ? `${resolved.loc.name}, ${stLabel}` : resolved.loc.name;
  return {
    title: `Horse Stables in ${where}`,
    description: `Find horse stables and barns in ${resolved.loc.name}${st ? `, ${st.name}` : ""} — boarding, training, and facilities near you.`,
    robots: robots(isHubIndexable(count)),
    alternates: {
      canonical: absoluteUrl(
        resolved.kind === "city" ? cityUrl(state, place) : countyUrl(state, place),
      ),
    },
  };
}

export default async function PlacePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { state, place } = await params;
  const { page: pageParam } = await searchParams;
  const resolved = await getPlaceBySlug(state, place);
  if (!resolved) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const { state: stateLoc, county: countyLoc } = stateInfo(resolved);
  const canonicalPath = resolved.kind === "city" ? cityUrl(state, place) : countyUrl(state, place);
  const stCode = stateLoc?.code ? `, ${stateLoc.code}` : "";

  const [results, spotlights, childCities] = await Promise.all([
    getByLocation(resolved.loc.id, page),
    page === 1 ? getActiveSpotlightsForArea(resolved.loc.id) : Promise.resolve([]),
    resolved.kind === "county" ? getChildren(resolved.loc.id, "CITY") : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          ...(stateLoc ? [{ name: stateLoc.name, url: stateUrl(state) }] : []),
          ...(countyLoc ? [{ name: countyLoc.name, url: countyUrl(state, countyLoc.slug) }] : []),
          { name: resolved.loc.name, url: canonicalPath },
        ]}
      />
      <h1 className="mt-4 text-3xl font-semibold text-pine">
        Horse stables in {resolved.loc.name}
        {stCode}
      </h1>
      <p className="mt-1 text-ink/55">
        {results.total} {results.total === 1 ? "stable" : "stables"} · Updated {new Date().getFullYear()}
      </p>

      {/* County hubs list their cities as quick chips. */}
      {childCities.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {childCities.map((c) => (
            <Link
              key={c.id}
              href={cityUrl(state, c.slug)}
              className="rounded-full bg-pine/5 px-3 py-1 text-sm text-pine hover:bg-brass/10 hover:text-brass"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <FeaturedSpotlights spotlights={spotlights} title={`Featured near ${resolved.loc.name}`} />

      {results.items.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center text-ink/55">
          No stables here yet. We&apos;re actively adding new listings — check back soon.
        </p>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.items.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
          <Pagination basePath={canonicalPath} page={results.page} totalPages={results.totalPages} />
        </>
      )}

      {/* Lateral local links — only for city hubs (need a point to measure from). */}
      {resolved.kind === "city" && (
        <NearbyCityLinks
          lat={resolved.loc.latitude}
          lng={resolved.loc.longitude}
          locationId={resolved.loc.id}
          excludeCitySlug={resolved.loc.slug}
          heading={`Stables in cities near ${resolved.loc.name}`}
        />
      )}
    </div>
  );
}
