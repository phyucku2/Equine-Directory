import Link from "next/link";
import { getActiveSpotlightsGlobal } from "@/lib/db/spotlight";
import { BusinessCard } from "@/components/business/BusinessCard";
import { cityUrl } from "@/lib/urls";

// Homepage ad space (replaces the static "Florida horse country" block, per the
// Zillow-model review). Paid Spotlight barns fill the slots; an "Advertise
// here" tile sells the empty ones. When nothing is sponsored yet, the popular-
// regions hub list renders as crawlable fallback so the section is never blank.

const FALLBACK_REGIONS = [
  { name: "Ocala", state: "florida", city: "ocala", desc: "Horse Capital of the World" },
  { name: "Wellington", state: "florida", city: "wellington", desc: "Winter equestrian circuit" },
  { name: "Tampa", state: "florida", city: "tampa", desc: "Gulf Coast hub" },
  { name: "Sarasota", state: "florida", city: "sarasota", desc: "Shows & boarding" },
  { name: "Gainesville", state: "florida", city: "gainesville", desc: "North Central FL" },
];

function AdvertiseTile() {
  return (
    <Link
      href="/claim"
      className="flex flex-col justify-center rounded-2xl border-2 border-dashed border-brass/40 bg-brass/5 p-5 text-center transition hover:border-brass hover:shadow-md"
    >
      <p className="text-lg font-semibold text-pine">Your barn here</p>
      <p className="mt-1 text-sm text-ink/55">
        Spotlight placement puts your business in front of local horse owners — from $25/week.
      </p>
      <p className="mt-3 text-sm font-semibold text-brass">Advertise here →</p>
    </Link>
  );
}

export async function SponsoredRegions() {
  let spotlights: Awaited<ReturnType<typeof getActiveSpotlightsGlobal>> = [];
  try {
    spotlights = await getActiveSpotlightsGlobal();
  } catch {
    // DB hiccup at render — fall through to the static fallback.
  }

  if (spotlights.length > 0) {
    return (
      <section className="py-14">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">Sponsored</p>
            <h2 className="mt-1 text-3xl font-semibold text-pine">Featured this week</h2>
          </div>
          <span className="pb-1 text-xs text-ink/40">Sponsored placements</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {spotlights.map((s) => (
            <BusinessCard key={s.spotlightId} business={s.business} />
          ))}
          <AdvertiseTile />
        </div>
      </section>
    );
  }

  // No paid placements yet: crawlable popular-regions fallback + the sell.
  return (
    <section className="py-14">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">Where to look</p>
        <h2 className="mt-1 text-3xl font-semibold text-pine">Popular horse country</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FALLBACK_REGIONS.map((r) => (
          <Link
            key={r.name}
            href={cityUrl(r.state, r.city)}
            className="rounded-2xl border border-leather/15 bg-white p-5 transition hover:border-brass hover:shadow-md"
          >
            <h3 className="text-lg font-semibold text-pine">{r.name}</h3>
            <p className="mt-1 text-sm text-ink/55">{r.desc}</p>
          </Link>
        ))}
        <AdvertiseTile />
      </div>
    </section>
  );
}
