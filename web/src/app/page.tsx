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

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-7">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">{eyebrow}</p>
      <h2 className="mt-1 font-serif text-3xl font-semibold text-pine">{title}</h2>
    </div>
  );
}

export default async function HomePage() {
  const [featured, categories, counts] = await Promise.all([
    getFeatured(6),
    getTopLevelCategories(),
    getCategoryCounts(),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-leather/15 bg-cream-dark">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">
          <p className="text-sm font-semibold text-brass">Florida-first · Expanding nationwide</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Find the right stable for your horse
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink/60">
            Browse and compare horse stables and barns near you across Florida.
          </p>
          <form action="/search" className="mx-auto mt-8 flex max-w-xl gap-2">
            <input
              type="search"
              name="q"
              placeholder="Search stables by name or city…"
              aria-label="Search stables"
              className="w-full rounded-lg border border-leather/30 bg-white px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-brass"
            />
            <button
              type="submit"
              className="rounded-lg bg-pine px-5 py-3 font-semibold text-cream transition hover:bg-pine-light"
            >
              Search
            </button>
          </form>
          <Link href="/map" className="mt-4 inline-block text-sm font-medium text-brass hover:underline">
            Or browse the map →
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* Featured */}
        {featured.length > 0 && (
          <section className="py-14">
            <SectionHeading eyebrow="Handpicked" title="Featured stables" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((b) => (
                <BusinessCard key={b.id} business={b} />
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <section className="py-14">
          <SectionHeading eyebrow="Explore" title="Browse by type" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => {
              const count =
                cat.children.reduce((sum, c) => sum + (counts[c.slug] ?? 0), 0) +
                (counts[cat.slug] ?? 0);
              return (
                <Link
                  key={cat.id}
                  href={categoryUrl(cat.slug)}
                  className="rounded-2xl border border-leather/15 bg-white p-5 transition hover:border-brass hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-semibold text-pine">{cat.name}</h3>
                    {count > 0 && (
                      <span className="rounded-full bg-pine/5 px-2 py-0.5 text-xs font-medium text-pine">
                        {count}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink/55">{cat.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Top regions */}
        <section className="py-14">
          <SectionHeading eyebrow="Where to look" title="Florida horse country" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOP_REGIONS.map((r) => (
              <Link
                key={r.name}
                href={cityUrl("florida", r.county, r.name.toLowerCase())}
                className="rounded-2xl border border-leather/15 bg-white p-5 transition hover:border-brass hover:shadow-md"
              >
                <h3 className="font-serif text-lg font-semibold text-pine">{r.name}</h3>
                <p className="mt-1 text-sm text-ink/55">{r.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Claim CTA */}
        <section className="my-14 rounded-2xl bg-pine px-6 py-12 text-center text-cream">
          <h2 className="text-2xl font-bold">Own a stable?</h2>
          <p className="mx-auto mt-2 max-w-xl text-cream/70">
            Add or claim your stable&rsquo;s free listing to manage your details and photos, and
            reach horse owners looking for a place to board and ride.
          </p>
          <Link
            href="/claim"
            className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-ink transition hover:bg-cream-dark"
          >
            List your stable
          </Link>
        </section>
      </div>
    </div>
  );
}
