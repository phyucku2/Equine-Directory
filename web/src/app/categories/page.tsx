import Link from "next/link";
import type { Metadata } from "next";
import { getTopLevelCategories, getCategoryCounts } from "@/lib/db/category";
import { categoryUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "All categories",
  description: "Browse all equine business categories — boarding, training, veterinary, farriers, tack, feed and more.",
  alternates: { canonical: absoluteUrl("/categories") },
};

export default async function CategoriesIndexPage() {
  const [categories, counts] = await Promise.all([getTopLevelCategories(), getCategoryCounts()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs items={[{ name: "Home", url: "/" }, { name: "Categories", url: "/categories" }]} />
      <h1 className="mt-4 text-3xl font-bold text-stone-900">Equine business categories</h1>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-xl border border-stone-200 bg-white p-5">
            <Link href={categoryUrl(cat.slug)} className="font-semibold text-stone-900 hover:text-emerald-800">
              {cat.name}
            </Link>
            <ul className="mt-3 space-y-1 text-sm">
              {cat.children.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <Link href={categoryUrl(c.slug)} className="text-stone-600 hover:text-emerald-700">
                    {c.name}
                  </Link>
                  {counts[c.slug] ? (
                    <span className="text-xs text-stone-400">{counts[c.slug]}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
