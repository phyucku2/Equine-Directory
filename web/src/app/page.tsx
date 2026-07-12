import Link from "next/link";
import { getFeatured } from "@/lib/db/business";
import { FeaturedStables } from "@/components/home/FeaturedStables";
import { NearbyStables } from "@/components/home/NearbyStables";
import { NearbyCities } from "@/components/home/NearbyCities";
import { SponsoredRegions } from "@/components/home/SponsoredRegions";
import { SERVICE_SEGMENTS } from "@/lib/catalog";
import { categoryUrl } from "@/lib/urls";

// Homepage blurbs per service segment (label/slugs come from the catalog).
const SEGMENT_BLURBS: Record<string, string> = {
  boarding: "Stables & barns with stalls, board, and turnout",
  training: "Trainers, riding instructors, and training barns",
  vets: "Large-animal & equine veterinarians",
  farriers: "Shoeing, trimming, and corrective farriery",
  tack: "Saddles, bridles, and riding gear",
  feed: "Feed, hay, and forage suppliers",
};

export const revalidate = 3600;

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-7">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">{eyebrow}</p>
      <h2 className="mt-1 text-3xl font-semibold text-pine">{title}</h2>
    </div>
  );
}

export default async function HomePage() {
  // Resilient to a build-time DB blip (cold Neon): empty now, ISR fills at runtime.
  let featured: Awaited<ReturnType<typeof getFeatured>> = [];
  try {
    featured = await getFeatured(6);
  } catch {
    /* DB unreachable at build — render without the featured rail; ISR repopulates. */
  }

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
            Stables, trainers, vets, farriers, tack &amp; feed — compare equine services near you,
            nationwide.
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
        {/* Zillow-model section order: personalized rail first (their "Homes
            for you"), then the intent CTAs, then paid/featured placements,
            then the geographic explore links. */}

        {/* Stables near you (geo-aware; hides itself when nothing is close) */}
        <NearbyStables />

        {/* Browse by service — the six public verticals (Goal 3); the
            Buy/Sell/Rent-style intent cards of the Zillow homepage. */}
        <section className="py-14">
          <SectionHeading eyebrow="What do you need?" title="Browse by service" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_SEGMENTS.map((seg) => (
              <Link
                key={seg.key}
                href={categoryUrl(seg.slugs[0])}
                className="rounded-2xl border border-leather/15 bg-white p-5 transition hover:border-brass hover:shadow-md"
              >
                <h3 className="text-lg font-semibold text-pine">{seg.label}</h3>
                <p className="mt-1 text-sm text-ink/55">{SEGMENT_BLURBS[seg.key]}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured — local to the visitor (paid/spotlight barns in their area
            first, then the best local barns); server-rendered national set is the
            SEO/no-JS fallback and initial paint. */}
        <FeaturedStables initial={featured} />

        {/* Cities near you (geo-aware; hides itself when geo is unknown). The
            sponsored/regions block below stays crawlable as the SEO fallback. */}
        <NearbyCities />

        {/* Ad space: paid Spotlight placements (falls back to the crawlable
            popular-regions hub list + an "Advertise here" tile). */}
        <SponsoredRegions />

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
