import Link from "next/link";
import { getFeatured } from "@/lib/db/business";
import { FeaturedStables } from "@/components/home/FeaturedStables";
import { NearbyStables } from "@/components/home/NearbyStables";
import { NearbyCities } from "@/components/home/NearbyCities";
import { cityUrl } from "@/lib/urls";

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
      <h2 className="mt-1 text-3xl font-semibold text-pine">{title}</h2>
    </div>
  );
}

export default async function HomePage() {
  const featured = await getFeatured(6);

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-pine">
        {/* Background photo (loaded by the visitor's browser) */}
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-stable.jpg')" }}
          aria-hidden
        />
        {/* Legibility overlay so the white text stays readable over the photo */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/50 to-black/65"
          aria-hidden
        />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:py-28">
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl">
            Find the right stable for your horse
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">
            Browse and compare horse stables and barns near you — nationwide.
          </p>
          <form action="/search" className="mx-auto mt-8 flex max-w-xl gap-2">
            <input
              type="search"
              name="q"
              placeholder="Search stables by name or city…"
              aria-label="Search stables"
              className="w-full rounded-lg border border-white/20 bg-white px-4 py-3 text-ink shadow-lg focus:outline-none focus:ring-2 focus:ring-brass"
            />
            <button
              type="submit"
              className="rounded-lg bg-brass px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-brass-light"
            >
              Search
            </button>
          </form>
          <Link
            href="/map"
            className="mt-4 inline-block text-sm font-medium text-white/90 transition hover:text-white hover:underline"
          >
            Or browse the map →
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* Featured — local to the visitor (paid/spotlight barns in their area
            first, then the best local barns); server-rendered national set is the
            SEO/no-JS fallback and initial paint. */}
        <FeaturedStables initial={featured} />

        {/* Stables near you (geo-aware; hides itself when nothing is close) */}
        <NearbyStables />

        {/* Cities near you (geo-aware; hides itself when geo is unknown). The
            static hub list below stays crawlable as the SEO fallback. */}
        <NearbyCities />

        {/* Top regions (static, crawlable fallback hub list) */}
        <section className="py-14">
          <SectionHeading eyebrow="Where to look" title="Florida horse country" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOP_REGIONS.map((r) => (
              <Link
                key={r.name}
                href={cityUrl("florida", r.county, r.name.toLowerCase())}
                className="rounded-2xl border border-leather/15 bg-white p-5 transition hover:border-brass hover:shadow-md"
              >
                <h3 className="text-lg font-semibold text-pine">{r.name}</h3>
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
