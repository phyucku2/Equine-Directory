import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCountyBySlug, getChildren } from "@/lib/db/location";
import { getByLocation, countByLocation } from "@/lib/db/business";
import { countyUrl, cityUrl, stateUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Pagination } from "@/components/Pagination";
import { robots, isHubIndexable } from "@/lib/seo/indexing";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; county: string }>;
}): Promise<Metadata> {
  const { state, county } = await params;
  const loc = await getCountyBySlug(state, county);
  if (!loc) return { title: "County not found" };
  const count = await countByLocation(loc.id);
  return {
    title: `Horse Stables in ${loc.name}, FL`,
    description: `Find horse stables and barns in ${loc.name}, Florida — boarding, training, and facilities near you.`,
    robots: robots(isHubIndexable(count)),
    alternates: { canonical: absoluteUrl(countyUrl(state, county)) },
  };
}

export default async function CountyPage({
  params,
  searchParams,
}: {
  params: Promise<{ state: string; county: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { state, county } = await params;
  const { page: pageParam } = await searchParams;
  const loc = await getCountyBySlug(state, county);
  if (!loc) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const [cities, results] = await Promise.all([
    getChildren(loc.id, "CITY"),
    getByLocation(loc.id, page),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          { name: loc.parent?.name ?? "Florida", url: stateUrl(state) },
          { name: loc.name, url: countyUrl(state, county) },
        ]}
      />
      <h1 className="mt-4 font-serif text-3xl font-semibold text-pine">Horse stables in {loc.name}</h1>
      <p className="mt-1 text-ink/55">
        {results.total} {results.total === 1 ? "stable" : "stables"} · Updated {new Date().getFullYear()}
      </p>

      {cities.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {cities.map((c) => (
            <Link
              key={c.id}
              href={cityUrl(state, county, c.slug)}
              className="rounded-full bg-pine/5 px-3 py-1 text-sm text-pine hover:bg-brass/10 hover:text-brass"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

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
          <Pagination basePath={countyUrl(state, county)} page={results.page} totalPages={results.totalPages} />
        </>
      )}
    </div>
  );
}
