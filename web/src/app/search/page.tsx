import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { businessCardInclude, type BusinessCard as BusinessCardData } from "@/lib/db/business";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Search",
  description: "Search Florida equine businesses and services.",
  robots: "noindex,follow",
};

// Basic search (name/description/city contains). Ranked FTS API arrives in T14.
async function search(q: string): Promise<BusinessCardData[]> {
  if (!q.trim()) return [];
  return prisma.business.findMany({
    where: {
      isPublished: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { location: { name: { contains: q, mode: "insensitive" } } },
        { categories: { some: { reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] }, category: { name: { contains: q, mode: "insensitive" } } } } },
      ],
    },
    include: businessCardInclude,
    orderBy: [{ isFeatured: "desc" }, { reviewCount: "desc" }],
    take: 48,
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await search(q);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs items={[{ name: "Home", url: "/" }, { name: "Search", url: "/search" }]} />

      <form action="/search" className="mt-4 flex max-w-2xl gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search boarding, vets, trainers…"
          aria-label="Search listings"
          className="w-full rounded-lg border border-stone-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button type="submit" className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800">
          Search
        </button>
      </form>

      {q && (
        <p className="mt-4 text-sm text-stone-500">
          {results.length} {results.length === 1 ? "result" : "results"} for “{q}”
        </p>
      )}

      {q && results.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          No matches. Try a category like “boarding” or a city like “Ocala”.
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((b) => (
            <BusinessCard key={b.id} business={b} />
          ))}
        </div>
      )}
    </div>
  );
}
