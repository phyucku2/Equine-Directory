import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AdSlot } from "@/components/ads/AdSlot";
import { getCategoryBySlug } from "@/lib/db/category";
import { getStateBySlug } from "@/lib/db/location";
import { getByCategoryAndLocation, isPublicCategorySlug } from "@/lib/db/business";
import { getCategoryStateCombos, getCategoryCitiesInState } from "@/lib/db/intent";
import { categoryStateUrl, intentUrl, categoryUrl, stateUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Pagination } from "@/components/Pagination";
import { JsonLd } from "@/components/JsonLd";
import { collectionLd, faqLd } from "@/lib/seo/jsonld";
import { categoryCopy } from "@/lib/seo/copy";
import { robots, isHubIndexable } from "@/lib/seo/indexing";

export const revalidate = 3600;

// Statewide category pillar: /[category]/[state] (SEO Lever 2). Sits between the
// national category hub (/categories/[category]) and the per-city intent pages
// (/[category]/[state]/[city]) — the layer that answers "horse boarding in
// Texas", "farriers in Florida". Aggregates every city's listings for the
// category in the state and links out to each city page (internal-link mesh).
type Params = { category: string; state: string };

export async function generateStaticParams() {
  try {
    const combos = await getCategoryStateCombos(400);
    return combos.filter((c) => isPublicCategorySlug(c.category));
  } catch {
    return [];
  }
}

async function load(p: Params) {
  const [cat, state] = await Promise.all([getCategoryBySlug(p.category), getStateBySlug(p.state)]);
  return { cat, state };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  if (!isPublicCategorySlug(p.category)) return { title: "Not found" };
  const { cat, state } = await load(p);
  if (!cat || !state) return { title: "Not found" };
  const count = await getByCategoryAndLocation(p.category, state.id, 1);
  const st = state.code ?? state.name;
  return {
    title: `${cat.name} in ${state.name} (${st}) — Listings by City`,
    description: `Find ${cat.name.toLowerCase()} across ${state.name}. Browse ${count.total} listings by city, compare reviews, and contact facilities directly.`,
    robots: robots(isHubIndexable(count.total)),
    alternates: { canonical: absoluteUrl(categoryStateUrl(p.category, p.state)) },
    openGraph: { title: `${cat.name} in ${state.name}`, type: "website" },
  };
}

export default async function CategoryStatePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const p = await params;
  const pageParam = (await searchParams).page;
  if (!isPublicCategorySlug(p.category)) notFound();
  const { cat, state } = await load(p);
  if (!cat || !state) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const [results, cities] = await Promise.all([
    getByCategoryAndLocation(p.category, state.id, page),
    page === 1 ? getCategoryCitiesInState(p.category, p.state, 60) : Promise.resolve([]),
  ]);

  const self = categoryStateUrl(p.category, p.state);
  const label = cat.name.toLowerCase();
  const copy = categoryCopy(p.category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <JsonLd data={collectionLd(`${cat.name} in ${state.name}`, self, results.items)} />
      {copy && copy.faqs.length > 0 && <JsonLd data={faqLd(copy.faqs)} />}
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          { name: cat.name, url: categoryUrl(cat.slug) },
          { name: state.name, url: stateUrl(state.slug) },
        ]}
      />

      <header className="mt-4">
        <h1 className="text-3xl font-bold text-pine">
          {cat.name} in {state.name}
        </h1>
        <p className="mt-1 text-ink/55">
          {results.total} {results.total === 1 ? "listing" : "listings"}
          {cities.length > 0 && ` across ${cities.length} ${cities.length === 1 ? "city" : "cities"}`} ·
          Updated {new Date().getFullYear()}
        </p>
        {copy && (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/65">{copy.intro(state.name)}</p>
        )}
      </header>

      {/* City mesh — the pillar's core SEO value: a link to every city page that
          has this category in the state. */}
      {cities.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-pine">{cat.name} by city in {state.name}</h2>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {cities.map((c) => (
              <Link
                key={c.slug}
                href={intentUrl(p.category, p.state, c.slug)}
                className="flex items-baseline justify-between gap-2 rounded px-1 py-0.5 hover:text-brass"
              >
                <span className="truncate text-ink/75">{c.name}</span>
                <span className="shrink-0 text-xs text-ink/40">{c.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.items.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-leather/30 bg-white p-8 text-center text-ink/55">
          <p>No {label} listed in {state.name} yet.</p>
          <p className="mt-2 text-sm">
            Browse{" "}
            <Link href={categoryUrl(cat.slug)} className="text-brass hover:underline">
              all {label} nationwide
            </Link>{" "}
            or{" "}
            <Link href={stateUrl(state.slug)} className="text-brass hover:underline">
              every stable in {state.name}
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <h2 className="mt-10 text-lg font-semibold text-pine">Featured {label} in {state.name}</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.items.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
          <Pagination basePath={self} page={results.page} totalPages={results.totalPages} />
        </>
      )}

      {/* FAQ (schema-backed above) */}
      {copy && copy.faqs.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-pine">
            {cat.name} in {state.name} — FAQ
          </h2>
          <div className="mt-3 space-y-2">
            {copy.faqs.map((f) => (
              <details key={f.q} className="rounded-xl border border-leather/15 bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-pine">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* One ad unit per page, below the listings + FAQ (owner: tasteful, minimal). */}
      <AdSlot />

      <div className="mt-10 flex flex-wrap gap-3 text-sm">
        <Link href={categoryUrl(cat.slug)} className="text-brass hover:underline">
          All {label} nationwide →
        </Link>
        <Link href={stateUrl(state.slug)} className="text-brass hover:underline">
          Every stable in {state.name} →
        </Link>
      </div>
    </div>
  );
}
