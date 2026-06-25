import type { Metadata } from "next";
import Link from "next/link";
import { searchBusinesses, getCategoryFacets, type SearchParams } from "@/lib/db/search";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/Pagination";

export const metadata: Metadata = {
  title: "Search",
  description: "Search Florida equine businesses and services.",
  robots: "noindex,follow",
};

type RawParams = {
  q?: string;
  category?: string;
  city?: string;
  county?: string;
  minRating?: string;
  verified?: string;
  page?: string;
};

function toSearchParams(p: RawParams): SearchParams {
  return {
    q: p.q,
    categorySlug: p.category,
    citySlug: p.city,
    countySlug: p.county,
    minRating: p.minRating ? Number(p.minRating) : undefined,
    verifiedOnly: p.verified === "1",
    page: p.page ? Number(p.page) : 1,
  };
}

// Build a /search URL with some params overridden (drop page on filter change).
function searchHref(base: RawParams, override: Partial<RawParams>): string {
  const merged: RawParams = { ...base, ...override, page: undefined };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `/search?${s}` : "/search";
}

const RATINGS = [
  { value: "4", label: "4★ & up" },
  { value: "3", label: "3★ & up" },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const raw = await searchParams;
  const params = toSearchParams(raw);
  const [results, facets] = await Promise.all([
    searchBusinesses(params),
    getCategoryFacets(params),
  ]);

  const activeChips: { label: string; href: string }[] = [];
  if (raw.category) {
    const name = facets.find((f) => f.slug === raw.category)?.name ?? raw.category;
    activeChips.push({ label: name, href: searchHref(raw, { category: undefined }) });
  }
  if (raw.verified === "1") activeChips.push({ label: "Verified only", href: searchHref(raw, { verified: undefined }) });
  if (raw.minRating) activeChips.push({ label: `${raw.minRating}★ & up`, href: searchHref(raw, { minRating: undefined }) });

  const filters = (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Category</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {facets.length === 0 && <li className="text-stone-400">No categories</li>}
          {facets.slice(0, 14).map((f) => {
            const active = raw.category === f.slug;
            return (
              <li key={f.slug}>
                <Link
                  href={searchHref(raw, { category: active ? undefined : f.slug })}
                  className={`flex items-center justify-between rounded px-2 py-1 ${
                    active ? "bg-emerald-50 font-medium text-emerald-800" : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <span>{f.name}</span>
                  <span className="text-xs text-stone-400">{f.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Rating</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {RATINGS.map((r) => {
            const active = raw.minRating === r.value;
            return (
              <li key={r.value}>
                <Link
                  href={searchHref(raw, { minRating: active ? undefined : r.value })}
                  className={`block rounded px-2 py-1 ${
                    active ? "bg-emerald-50 font-medium text-emerald-800" : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {r.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Trust</h3>
        <Link
          href={searchHref(raw, { verified: raw.verified === "1" ? undefined : "1" })}
          className={`mt-2 inline-flex items-center gap-2 rounded px-2 py-1 text-sm ${
            raw.verified === "1" ? "bg-emerald-50 font-medium text-emerald-800" : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          <span className={`h-4 w-4 rounded border ${raw.verified === "1" ? "border-emerald-600 bg-emerald-600" : "border-stone-300"}`} />
          Verified only
        </Link>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs items={[{ name: "Home", url: "/" }, { name: "Search", url: "/search" }]} />

      <form action="/search" className="mt-4 flex max-w-2xl gap-2">
        <input
          type="search"
          name="q"
          defaultValue={raw.q ?? ""}
          placeholder="Search boarding, vets, trainers…"
          aria-label="Search listings"
          className="w-full rounded-lg border border-stone-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {raw.category && <input type="hidden" name="category" value={raw.category} />}
        <button type="submit" className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800">
          Search
        </button>
      </form>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {activeChips.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800 hover:bg-emerald-200"
            >
              {c.label}
              <span aria-hidden>×</span>
            </Link>
          ))}
          <Link href={searchHref({ q: raw.q }, {})} className="text-sm text-stone-500 hover:underline">
            Clear all
          </Link>
        </div>
      )}

      <p className="mt-4 text-sm text-stone-500">
        {results.total} {results.total === 1 ? "result" : "results"}
        {raw.q ? ` for “${raw.q}”` : ""}
      </p>

      {/* Mobile filter disclosure (no-JS friendly) */}
      <details className="mt-4 rounded-lg border border-stone-200 bg-white p-4 lg:hidden">
        <summary className="cursor-pointer font-medium text-stone-700">Filters</summary>
        <div className="mt-4">{filters}</div>
      </details>

      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">{filters}</aside>

        <div>
          {results.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
              No matches. Try a category like “boarding” or a city like “Ocala”.
            </p>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results.items.map((b) => (
                  <BusinessCard key={b.id} business={b} />
                ))}
              </div>
              <Pagination
                basePath={searchHref(raw, {})}
                page={results.page}
                totalPages={results.totalPages}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
