import Link from "next/link";
import type { Metadata } from "next";
import { countByCategory } from "@/lib/db/business";
import { getCategoryBySlug } from "@/lib/db/category";
import { SERVICE_SEGMENTS } from "@/lib/catalog";
import { categoryUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Browse equine services",
  description:
    "Find horse boarding stables, trainers, equine vets, farriers, tack shops, and feed stores near you.",
  alternates: { canonical: absoluteUrl("/categories") },
};

// The six public service verticals, each linking to its category hub. Segment
// slugs beyond the first (e.g. trainer-instructor under Training) are listed as
// secondary links inside the tile.
export default async function CategoriesIndexPage() {
  const tiles = await Promise.all(
    SERVICE_SEGMENTS.map(async (seg) => {
      const cats = await Promise.all(
        seg.slugs.map(async (slug) => ({
          slug,
          cat: await getCategoryBySlug(slug),
          count: await countByCategory(slug),
        })),
      );
      return { seg, cats: cats.filter((c) => c.cat !== null) };
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs items={[{ name: "Home", url: "/" }, { name: "Categories", url: "/categories" }]} />
      <header className="mt-4">
        <h1 className="text-3xl font-bold text-pine">Browse equine services</h1>
        <p className="mt-1 text-ink/55">
          Boarding stables, trainers, vets, farriers, tack shops, and feed stores — nationwide.
        </p>
      </header>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ seg, cats }) => {
          const primary = cats[0];
          if (!primary) return null;
          const total = cats.reduce((n, c) => n + c.count, 0);
          return (
            <Link
              key={seg.key}
              href={categoryUrl(primary.slug)}
              className="rounded-2xl border border-leather/15 bg-white p-5 transition hover:border-brass hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-pine">{seg.label}</h2>
              <p className="mt-1 text-sm text-ink/55">{primary.cat?.description}</p>
              <p className="mt-3 text-xs font-medium text-brass">
                {total} {total === 1 ? "listing" : "listings"} →
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
