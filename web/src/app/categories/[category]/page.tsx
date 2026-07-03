import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug } from "@/lib/db/category";
import { getByCategory, countByCategory, isPublicCategorySlug, PUBLIC_CATEGORY_SLUGS } from "@/lib/db/business";
import { categoryUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Pagination } from "@/components/Pagination";
import { JsonLd } from "@/components/JsonLd";
import { collectionLd } from "@/lib/seo/jsonld";
import { robots, isHubIndexable } from "@/lib/seo/indexing";

export const revalidate = 86400;

export function generateStaticParams() {
  // Every public catalog category gets a pre-rendered hub (boarding, training,
  // vets, farriers, tack, feed — see src/lib/catalog.ts).
  return PUBLIC_CATEGORY_SLUGS.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (!cat) return { title: "Category not found" };
  const title = `${cat.name}`;
  const count = await countByCategory(category);
  return {
    title,
    description: cat.description ?? `Find ${cat.name.toLowerCase()} across the country.`,
    robots: robots(isHubIndexable(count)),
    alternates: { canonical: absoluteUrl(categoryUrl(category)) },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { category } = await params;
  const { page: pageParam } = await searchParams;
  // Hide non-catalog category hubs (their data stays in the DB).
  if (!isPublicCategorySlug(category)) notFound();
  const cat = await getCategoryBySlug(category);
  if (!cat) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const results = await getByCategory(category, page);

  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Categories", url: "/categories" },
    ...(cat.parent ? [{ name: cat.parent.name, url: categoryUrl(cat.parent.slug) }] : []),
    { name: cat.name, url: categoryUrl(cat.slug) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <JsonLd data={collectionLd(cat.name, categoryUrl(cat.slug), results.items)} />
      <Breadcrumbs items={crumbs} />

      <header className="mt-4">
        <h1 className="text-3xl font-bold text-pine">{cat.name}</h1>
        <p className="mt-1 text-ink/55">
          {results.total} {results.total === 1 ? "listing" : "listings"}
          {cat.description ? ` · ${cat.description}` : ""}
        </p>
      </header>

      {results.items.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-leather/30 bg-white p-8 text-center text-ink/55">
          No listings here yet. We&apos;re actively adding new businesses — check back soon.
        </p>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.items.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
          <Pagination basePath={categoryUrl(cat.slug)} page={results.page} totalPages={results.totalPages} />
        </>
      )}
    </div>
  );
}
