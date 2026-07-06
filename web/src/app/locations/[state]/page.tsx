import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getStateBySlug, getChildren } from "@/lib/db/location";
import { getCategoriesInState } from "@/lib/db/intent";
import { countyUrl, stateUrl, categoryStateUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FeaturedSpotlights } from "@/components/business/FeaturedSpotlights";
import { getActiveSpotlightsForArea } from "@/lib/db/spotlight";

export const revalidate = 86400;

export async function generateStaticParams() {
  return [{ state: "florida" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state } = await params;
  const loc = await getStateBySlug(state);
  if (!loc) return { title: "State not found" };
  return {
    title: `Horse Stables in ${loc.name}`,
    description: `Browse horse stables and barns across ${loc.name} by county — boarding, training, and facilities.`,
    alternates: { canonical: absoluteUrl(stateUrl(state)) },
  };
}

export default async function StatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const loc = await getStateBySlug(state);
  if (!loc) notFound();
  const [counties, spotlights, services] = await Promise.all([
    getChildren(loc.id, "COUNTY"),
    getActiveSpotlightsForArea(loc.id),
    getCategoriesInState(state),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs items={[{ name: "Home", url: "/" }, { name: loc.name, url: stateUrl(state) }]} />
      <h1 className="mt-4 text-3xl font-semibold text-pine">Horse stables across {loc.name}</h1>

      <FeaturedSpotlights spotlights={spotlights} title="Featured near you" />

      {/* Browse by service — statewide category pillars (SEO Lever 2) */}
      {services.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-pine">Equine services in {loc.name}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {services.map((s) => (
              <Link
                key={s.slug}
                href={categoryStateUrl(s.slug, state)}
                className="rounded-full bg-pine/5 px-3 py-1 text-sm text-pine transition hover:bg-brass/10 hover:text-brass"
              >
                {s.name} <span className="text-ink/40">{s.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <h2 className="mt-8 text-lg font-semibold text-pine">Browse by county</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {counties.map((c) => (
          <Link
            key={c.id}
            href={countyUrl(state, c.slug)}
            className="rounded-lg border border-leather/15 bg-white px-4 py-3 text-ink/80 transition hover:border-brass hover:text-brass"
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
