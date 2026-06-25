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
    title: `Equine businesses in ${loc.name}`,
    description: `Browse equine businesses and services across ${loc.name} by county.`,
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
      <h1 className="mt-4 text-3xl font-bold text-stone-900">Equine businesses in {loc.name}</h1>
      <p className="mt-1 text-stone-500">Browse by county.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {counties.map((c) => (
          <Link
            key={c.id}
            href={countyUrl(state, c.slug)}
            className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-stone-700 transition hover:border-emerald-300 hover:text-emerald-800"
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
