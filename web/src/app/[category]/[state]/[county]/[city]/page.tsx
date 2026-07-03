import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCategoryBySlug } from "@/lib/db/category";
import { getCityBySlug } from "@/lib/db/location";
import { getByCategoryAndLocation, isPublicCategorySlug } from "@/lib/db/business";
import { getIntentCombos } from "@/lib/db/intent";
import { intentUrl, categoryUrl, cityUrl, countyUrl, stateUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BusinessCard } from "@/components/business/BusinessCard";
import { NearbyCityLinks } from "@/components/NearbyCityLinks";
import { Pagination } from "@/components/Pagination";
import { JsonLd } from "@/components/JsonLd";
import { collectionLd } from "@/lib/seo/jsonld";
import { categoryCopy } from "@/lib/seo/copy";
import { robots, isHubIndexable } from "@/lib/seo/indexing";

export const revalidate = 3600;

type Params = { category: string; state: string; county: string; city: string };

export async function generateStaticParams() {
  try {
    const combos = await getIntentCombos(200);
    return combos
      .filter((c) => isPublicCategorySlug(c.category))
      .map((c) => ({
      category: c.category,
      state: c.state,
      county: c.county,
      city: c.city,
    }));
  } catch {
    return [];
  }
}

async function load(p: Params) {
  const [cat, loc] = await Promise.all([
    getCategoryBySlug(p.category),
    getCityBySlug(p.state, p.county, p.city),
  ]);
  return { cat, loc };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const { cat, loc } = await load(p);
  if (!cat || !loc) return { title: "Not found" };
  const count = await getByCategoryAndLocation(p.category, loc.id, 1);
  const stateLoc = loc.parent?.parent;
  const stateName = stateLoc?.name ?? "";
  // Titles use "City, ST" — the pattern local queries are typed in.
  const st = stateLoc?.code ?? stateName;
  const title = st ? `${cat.name} in ${loc.name}, ${st}` : `${cat.name} in ${loc.name}`;
  return {
    title,
    description: `Find ${cat.name.toLowerCase()} in ${loc.name}${stateName ? `, ${stateName}` : ""}. Compare listings, reviews and contact details.`,
    robots: robots(isHubIndexable(count.total)),
    alternates: { canonical: absoluteUrl(intentUrl(p.category, p.state, p.county, p.city)) },
  };
}

export default async function IntentPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const p = await params;
  const { pageParam } = { pageParam: (await searchParams).page };
  // Only public catalog category hubs are browsable.
  if (!isPublicCategorySlug(p.category)) notFound();
  const { cat, loc } = await load(p);
  if (!cat || !loc) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const results = await getByCategoryAndLocation(p.category, loc.id, page);

  const county = loc.parent;
  const state = county?.parent;
  const placeName = state ? `${loc.name}, ${state.name}` : loc.name;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <JsonLd
        data={collectionLd(`${cat.name} in ${placeName}`, intentUrl(p.category, p.state, p.county, p.city), results.items)}
      />
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          { name: cat.name, url: categoryUrl(cat.slug) },
          ...(state ? [{ name: state.name, url: stateUrl(state.slug) }] : []),
          ...(state && county ? [{ name: county.name, url: countyUrl(state.slug, county.slug) }] : []),
          { name: loc.name, url: intentUrl(p.category, p.state, p.county, p.city) },
        ]}
      />

      <header className="mt-4">
        <h1 className="text-3xl font-bold text-pine">
          {cat.name} in {placeName}
        </h1>
        <p className="mt-1 text-ink/55">
          {results.total} {results.total === 1 ? "listing" : "listings"}
        </p>
        {(() => {
          const copy = categoryCopy(p.category);
          return copy ? (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/65">{copy.intro(placeName)}</p>
          ) : null;
        })()}
      </header>

      {results.items.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-leather/30 bg-white p-8 text-center text-ink/55">
          <p>No {cat.name.toLowerCase()} listed in {loc.name} yet.</p>
          <p className="mt-2 text-sm">
            Browse{" "}
            <Link href={categoryUrl(cat.slug)} className="text-brass hover:underline">
              all {cat.name.toLowerCase()} nationwide
            </Link>{" "}
            or{" "}
            <Link href={cityUrl(p.state, p.county, p.city)} className="text-brass hover:underline">
              everything in {loc.name}
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.items.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
          <Pagination
            basePath={intentUrl(p.category, p.state, p.county, p.city)}
            page={results.page}
            totalPages={results.totalPages}
          />
          <div className="mt-10 flex flex-wrap gap-3 text-sm">
            <Link href={categoryUrl(cat.slug)} className="text-brass hover:underline">
              All {cat.name.toLowerCase()} nationwide →
            </Link>
            <Link href={cityUrl(p.state, p.county, p.city)} className="text-brass hover:underline">
              Everything in {loc.name} →
            </Link>
          </div>
        </>
      )}

      {/* Lateral local links: same category in neighboring cities */}
      <NearbyCityLinks
        lat={loc.latitude}
        lng={loc.longitude}
        locationId={loc.id}
        excludeCitySlug={loc.slug}
        categorySlug={p.category}
        heading={`${cat.name} near ${loc.name}`}
      />
    </div>
  );
}
