import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getStateBySlug, getChildren } from "@/lib/db/location";
import { countyUrl, stateUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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
  const counties = await getChildren(loc.id, "COUNTY");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs items={[{ name: "Home", url: "/" }, { name: loc.name, url: stateUrl(state) }]} />
      <h1 className="mt-4 font-serif text-3xl font-semibold text-pine">Horse stables across {loc.name}</h1>
      <p className="mt-1 text-ink/55">Browse by county.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
