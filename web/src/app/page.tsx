import Link from "next/link";
import { getFeatured } from "@/lib/db/business";
import { getTopLevelCategories, getCategoryCounts } from "@/lib/db/category";
import { BusinessCard } from "@/components/business/BusinessCard";
import { categoryUrl, cityUrl } from "@/lib/urls";

export const revalidate = 3600;

const TOP_REGIONS = [
  { name: "Ocala", county: "marion", desc: "Horse Capital of the World" },
  { name: "Wellington", county: "palm-beach", desc: "Winter equestrian circuit" },
  { name: "Tampa", county: "hillsborough", desc: "Gulf Coast hub" },
  { name: "Sarasota", county: "sarasota", desc: "Shows & boarding" },
  { name: "Gainesville", county: "alachua", desc: "North Central FL" },
  { name: "Brooksville", county: "hernando", desc: "Trails & ranches" },
];

export default async function HomePage() {
  const [featured, categories, counts] = await Promise.all([
    getFeatured(6),
    getTopLevelCategories(),
    getCategoryCounts(),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-emerald-800 to-emerald-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Find trusted equine businesses in Florida
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-emerald-50">
            Boarding, training, veterinary care, farriers, tack &amp; feed, transportation and
            more — all in one place.
          </p>
          <form action="/search" className="mx-auto mt-8 flex max-w-xl gap-2">
            <input
              type="search"
              name="q"
              placeholder="Search boarding, vets, trainers…"
              aria-label="Search listings"
              className="w-full rounded-lg border-0 px-4 py-3 text-stone-900 shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              type="submit"
              className="rounded-lg bg-amber-400 px-5 py-3 font-semibold text-amber-950 transition hover:bg-amber-300"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* Featured */}
        {featured.length > 0 && (
          <section className="py-12">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-2xl font-bold text-stone-900">Featured listings</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((b) => (
                <BusinessCard key={b.id} business={b} />
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <section className="py-12">
          <h2 className="mb-6 text-2xl font-bold text-stone-900">Browse by category</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => {
              const count =
                cat.children.reduce((sum, c) => sum + (counts[c.slug] ?? 0), 0) +
                (counts[cat.slug] ?? 0);
              return (
                <Link
                  key={cat.id}
                  href={categoryUrl(cat.slug)}
                  className="rounded-xl border border-stone-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-stone-900">{cat.name}</h3>
                    {count > 0 && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {count}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-stone-500">{cat.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Top regions */}
        <section className="py-12">
          <h2 className="mb-6 text-2xl font-bold text-stone-900">Top Florida regions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOP_REGIONS.map((r) => (
              <Link
                key={r.name}
                href={cityUrl("florida", r.county, r.name.toLowerCase())}
                className="rounded-xl border border-stone-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-md"
              >
                <h3 className="font-semibold text-stone-900">{r.name}</h3>
                <p className="mt-1 text-sm text-stone-500">{r.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Claim CTA */}
        <section className="my-12 rounded-2xl bg-stone-900 px-6 py-12 text-center text-white">
          <h2 className="text-2xl font-bold">Own an equine business?</h2>
          <p className="mx-auto mt-2 max-w-xl text-stone-300">
            Claim your free listing to manage your profile, respond to reviews, and reach horse
            owners across Florida.
          </p>
          <Link
            href="/claim"
            className="mt-6 inline-block rounded-lg bg-amber-400 px-6 py-3 font-semibold text-amber-950 transition hover:bg-amber-300"
          >
            Claim your listing
          </Link>
        </section>
      </div>
    </div>
  );
}
