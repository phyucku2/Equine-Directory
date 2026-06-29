import { BusinessCard } from "@/components/business/BusinessCard";
import type { FeaturedSpotlight } from "@/lib/db/spotlight";

// Featured (Spotlight) placement block — a highlighted slot at the top of a
// city/area search (monetization-tiers.md §"Public display"). Renders nothing
// when there are no active spotlights, so callers can drop it in unconditionally.
export function FeaturedSpotlights({
  spotlights,
  title = "Featured stables",
}: {
  spotlights: FeaturedSpotlight[];
  title?: string;
}) {
  if (spotlights.length === 0) return null;
  return (
    <section className="mt-8 rounded-2xl border border-brass/30 bg-brass/5 p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brass px-2 py-0.5 text-xs font-semibold text-white">
          Featured
        </span>
        <h2 className="text-lg font-semibold text-pine">{title}</h2>
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {spotlights.map((s) => (
          <BusinessCard key={s.spotlightId} business={s.business} />
        ))}
      </div>
    </section>
  );
}
