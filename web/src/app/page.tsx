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
      <section className="relative overflow-hidden bg-pine text-cream">
        <div className="absolute inset-0 bg-gradient-to-b from-pine-light via-pine to-[#1a2c22]" />
        <div className="bg-grain absolute inset-0 opacity-60" />
        <div
          className="absolute -top-24 right-0 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-brass) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brass-light">
            Florida-first · Expanding nationwide
          </p>
          <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight sm:text-6xl">
            Find the right barn for your horse
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-cream/75">
            Browse and compare horse barns across Florida — boarding, training, and facilities,
            all in one place.
          </p>
          <form action="/search" className="mx-auto mt-9 flex max-w-xl gap-2">
            <input
              type="search"
              name="q"
              placeholder="Search barns by name, city, or county…"
              aria-label="Search barns"
              className="w-full rounded-lg border-0 px-4 py-3 text-ink shadow-lg focus:outline-none focus:ring-2 focus:ring-brass-light"
            />
            <button
              type="submit"
              className="rounded-lg bg-brass px-5 py-3 font-semibold text-pine shadow-lg transition hover:bg-brass-light"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* Featured */}
        {featured.length > 0 && (
          <section className="py-14">
            <SectionHeading eyebrow="Handpicked" title="Featured barns" />
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
        <section className="relative my-14 overflow-hidden rounded-3xl bg-pine px-6 py-14 text-center text-cream">
          <div className="bg-grain absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="font-serif text-3xl font-semibold">Own a barn?</h2>
            <p className="mx-auto mt-3 max-w-xl text-cream/75">
              Add or claim your barn&rsquo;s free listing to manage your details and photos, and
              reach horse owners looking for a place to board and ride.
            </p>
            <Link
              href="/claim"
              className="mt-7 inline-block rounded-lg bg-brass px-6 py-3 font-semibold text-pine transition hover:bg-brass-light"
            >
              List your barn
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
