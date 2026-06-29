import type { Metadata } from "next";
import Link from "next/link";
import { searchBusinesses, getCategoryFacets, type SearchParams } from "@/lib/db/search";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/Pagination";
import {
  DISCIPLINES,
  BOARD_TYPES,
  TRAINING_TYPES,
  sanitizeFacet,
  facetLabel,
  type FacetKey,
} from "@/lib/facets";

export const metadata: Metadata = {
  title: "Search stables",
  description: "Search horse stables and barns across Florida — boarding, training, and facilities.",
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
  // Facet filters — array facets are comma-separated slug lists in the URL.
  discipline?: string; // disciplines slugs
  board?: string; // boardTypes slugs
  training?: string; // trainingTypes slugs
  priceMax?: string;
  cameras?: string; // "1" -> securityFeatures hasSome security-cameras
  indoor?: string; // "1" -> amenities hasSome indoor-arena
  camp?: string; // "1" -> programs has summer-camp
  openBarn?: string; // "1" -> policies hasSome open-barn
  available?: string; // "1" -> spotsAvailable > 0
};

// Parse a comma-separated URL value into validated slugs for a facet vocab.
function parseFacet(key: FacetKey, raw: string | undefined): string[] {
  if (!raw) return [];
  return sanitizeFacet(key, raw.split(",").map((s) => s.trim()));
}

function toSearchParams(p: RawParams): SearchParams {
  const disciplines = parseFacet("disciplines", p.discipline);
  const boardTypes = parseFacet("boardTypes", p.board);
  const trainingTypes = parseFacet("trainingTypes", p.training);
  const securityFeatures = p.cameras === "1" ? ["security-cameras"] : [];
  const amenities = p.indoor === "1" ? ["indoor-arena"] : [];
  const policies = p.openBarn === "1" ? ["open-barn"] : [];
  const programTypes = p.camp === "1" ? ["summer-camp"] : [];
  const priceMaxNum = p.priceMax ? Number(p.priceMax) : NaN;

  return {
    q: p.q,
    categorySlug: p.category,
    citySlug: p.city,
    countySlug: p.county,
    minRating: p.minRating ? Number(p.minRating) : undefined,
    verifiedOnly: p.verified === "1",
    page: p.page ? Number(p.page) : 1,
    disciplines: disciplines.length ? disciplines : undefined,
    boardTypes: boardTypes.length ? boardTypes : undefined,
    trainingTypes: trainingTypes.length ? trainingTypes : undefined,
    securityFeatures: securityFeatures.length ? securityFeatures : undefined,
    amenities: amenities.length ? amenities : undefined,
    policies: policies.length ? policies : undefined,
    programTypes: programTypes.length ? programTypes : undefined,
    priceMax: Number.isFinite(priceMaxNum) && priceMaxNum > 0 ? priceMaxNum : undefined,
    availableNow: p.available === "1",
  };
}

// Toggle a slug inside a comma-separated facet URL value.
function toggleSlug(current: string | undefined, slug: string): string | undefined {
  const set = new Set((current ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  if (set.has(slug)) set.delete(slug);
  else set.add(slug);
  const out = [...set].join(",");
  return out || undefined;
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

const PRICE_OPTIONS = [
  { value: "500", label: "Under $500/mo" },
  { value: "800", label: "Under $800/mo" },
  { value: "1200", label: "Under $1,200/mo" },
  { value: "2000", label: "Under $2,000/mo" },
];

// Single-toggle facet flags (boolean "1" URL params). Each maps to one slug
// applied as hasSome on its column server-side (see toSearchParams).
const FLAG_FILTERS: { key: keyof RawParams; label: string }[] = [
  { key: "available", label: "Spots available" },
  { key: "cameras", label: "🎥 Cameras" },
  { key: "indoor", label: "Indoor arena" },
  { key: "camp", label: "Summer camp" },
  { key: "openBarn", label: "Open barn" },
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

  // Multi-select facet chips (one chip per selected slug; dismiss toggles it off).
  for (const slug of params.disciplines ?? [])
    activeChips.push({ label: facetLabel("disciplines", slug), href: searchHref(raw, { discipline: toggleSlug(raw.discipline, slug) }) });
  for (const slug of params.boardTypes ?? [])
    activeChips.push({ label: facetLabel("boardTypes", slug), href: searchHref(raw, { board: toggleSlug(raw.board, slug) }) });
  for (const slug of params.trainingTypes ?? [])
    activeChips.push({ label: facetLabel("trainingTypes", slug), href: searchHref(raw, { training: toggleSlug(raw.training, slug) }) });
  if (params.priceMax)
    activeChips.push({ label: `Under $${params.priceMax.toLocaleString()}/mo`, href: searchHref(raw, { priceMax: undefined }) });
  for (const f of FLAG_FILTERS) {
    if (raw[f.key] === "1")
      activeChips.push({ label: f.label, href: searchHref(raw, { [f.key]: undefined }) });
  }

  const filters = (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/55">Category</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {facets.length === 0 && <li className="text-ink/40">No categories</li>}
          {facets.slice(0, 14).map((f) => {
            const active = raw.category === f.slug;
            return (
              <li key={f.slug}>
                <Link
                  href={searchHref(raw, { category: active ? undefined : f.slug })}
                  className={`flex items-center justify-between rounded px-2 py-1 ${
                    active ? "bg-brass/10 font-medium text-brass" : "text-ink/65 hover:bg-pine/5"
                  }`}
                >
                  <span>{f.name}</span>
                  <span className="text-xs text-ink/40">{f.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/55">Rating</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {RATINGS.map((r) => {
            const active = raw.minRating === r.value;
            return (
              <li key={r.value}>
                <Link
                  href={searchHref(raw, { minRating: active ? undefined : r.value })}
                  className={`block rounded px-2 py-1 ${
                    active ? "bg-brass/10 font-medium text-brass" : "text-ink/65 hover:bg-pine/5"
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/55">Trust</h3>
        <Link
          href={searchHref(raw, { verified: raw.verified === "1" ? undefined : "1" })}
          className={`mt-2 inline-flex items-center gap-2 rounded px-2 py-1 text-sm ${
            raw.verified === "1" ? "bg-brass/10 font-medium text-brass" : "text-ink/65 hover:bg-pine/5"
          }`}
        >
          <span className={`h-4 w-4 rounded border ${raw.verified === "1" ? "border-brass bg-brass" : "border-leather/30"}`} />
          Verified only
        </Link>
      </div>

      {/* Quick toggles — boolean facet flags. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/55">Quick filters</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {FLAG_FILTERS.map((f) => {
            const active = raw[f.key] === "1";
            return (
              <Link
                key={f.key}
                href={searchHref(raw, { [f.key]: active ? undefined : "1" })}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  active ? "bg-pine text-cream" : "bg-white text-ink/65 ring-1 ring-leather/15 hover:ring-brass/40"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Price range — max monthly board (priceFrom <= value). */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/55">Price</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRICE_OPTIONS.map((p) => {
            const active = raw.priceMax === p.value;
            return (
              <Link
                key={p.value}
                href={searchHref(raw, { priceMax: active ? undefined : p.value })}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  active ? "bg-pine text-cream" : "bg-white text-ink/65 ring-1 ring-leather/15 hover:ring-brass/40"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Discipline — multi-select chips from the controlled vocab. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/55">Discipline</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DISCIPLINES.filter((o) => o.group !== "General").map((o) => {
            const active = (params.disciplines ?? []).includes(o.slug);
            return (
              <Link
                key={o.slug}
                href={searchHref(raw, { discipline: toggleSlug(raw.discipline, o.slug) })}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  active ? "bg-brass/15 text-brass ring-1 ring-brass/40" : "bg-white text-ink/60 ring-1 ring-leather/15 hover:ring-brass/40"
                }`}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Board type — multi-select chips. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/55">Board type</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BOARD_TYPES.map((o) => {
            const active = (params.boardTypes ?? []).includes(o.slug);
            return (
              <Link
                key={o.slug}
                href={searchHref(raw, { board: toggleSlug(raw.board, o.slug) })}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  active ? "bg-brass/15 text-brass ring-1 ring-brass/40" : "bg-white text-ink/60 ring-1 ring-leather/15 hover:ring-brass/40"
                }`}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Training type — multi-select chips. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/55">Training</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TRAINING_TYPES.map((o) => {
            const active = (params.trainingTypes ?? []).includes(o.slug);
            return (
              <Link
                key={o.slug}
                href={searchHref(raw, { training: toggleSlug(raw.training, o.slug) })}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  active ? "bg-brass/15 text-brass ring-1 ring-brass/40" : "bg-white text-ink/60 ring-1 ring-leather/15 hover:ring-brass/40"
                }`}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
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
          placeholder="Search stables by name, city, or county…"
          aria-label="Search stables"
          className="w-full rounded-lg border border-leather/25 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass"
        />
        {raw.category && <input type="hidden" name="category" value={raw.category} />}
        {/* Preserve active facet filters across a free-text submit. */}
        {(
          ["city", "county", "minRating", "verified", "discipline", "board", "training", "priceMax", "cameras", "indoor", "camp", "openBarn", "available"] as (keyof RawParams)[]
        ).map((k) =>
          raw[k] ? <input key={k} type="hidden" name={k} value={raw[k]} /> : null,
        )}
        <button type="submit" className="rounded-lg bg-pine px-5 py-3 font-semibold text-cream hover:bg-pine-light">
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
              className="inline-flex items-center gap-1 rounded-full bg-pine/10 px-3 py-1 text-sm text-pine hover:bg-pine/15"
            >
              {c.label}
              <span aria-hidden>×</span>
            </Link>
          ))}
          <Link href={searchHref({ q: raw.q }, {})} className="text-sm text-ink/55 hover:underline">
            Clear all
          </Link>
        </div>
      )}

      <p className="mt-4 text-sm text-ink/55">
        {results.total} {results.total === 1 ? "stable" : "stables"}
        {raw.q ? ` for “${raw.q}”` : ""}
      </p>

      {/* Mobile filter disclosure (no-JS friendly) */}
      <details className="mt-4 rounded-lg border border-leather/15 bg-white p-4 lg:hidden">
        <summary className="cursor-pointer font-medium text-pine">Filters</summary>
        <div className="mt-4">{filters}</div>
      </details>

      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">{filters}</aside>

        <div>
          {results.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center text-ink/55">
              No matches. Try a city like “Ocala” or “Davie”, or clear your filters.
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
