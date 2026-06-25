import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getBusinessBySlug, getRelated } from "@/lib/db/business";
import { businessUrl, categoryUrl, countyUrl, stateUrl, cityUrl, absoluteUrl } from "@/lib/urls";
import { telHref, ensureHttp, displayHostname } from "@/lib/format";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BusinessCard } from "@/components/business/BusinessCard";
import { VerificationBadge } from "@/components/business/VerificationBadge";
import { StarRating } from "@/components/StarRating";
import { JsonLd } from "@/components/JsonLd";
import { localBusinessLd } from "@/lib/seo/jsonld";
import { robots, isBusinessDetailIndexable } from "@/lib/seo/indexing";

export const revalidate = 3600;

export async function generateStaticParams() {
  const businesses = await prisma.business.findMany({
    where: { isPublished: true },
    select: { slug: true },
    take: 500,
  });
  return businesses.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return { title: "Listing not found" };
  const cat = business.categories[0]?.category.name;
  const title = `${business.name} — ${cat ?? "Equine business"} in ${business.location.name}, FL`;
  const description =
    business.description?.slice(0, 160) ??
    `${business.name} in ${business.location.name}, Florida.`;
  return {
    title,
    description,
    robots: robots(isBusinessDetailIndexable(business)),
    alternates: { canonical: absoluteUrl(businessUrl(slug)) },
    openGraph: { title, description, type: "website" },
  };
}

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const related = await getRelated(business);
  const county = business.location.parent;
  const state = county?.parent;
  const phoneHref = telHref(business.phone);
  const site = ensureHttp(business.website);

  const crumbs = [
    { name: "Home", url: "/" },
    ...(state ? [{ name: state.name, url: stateUrl(state.slug) }] : []),
    ...(state && county ? [{ name: county.name, url: countyUrl(state.slug, county.slug) }] : []),
    ...(state && county
      ? [{ name: business.location.name, url: cityUrl(state.slug, county.slug, business.location.slug) }]
      : []),
    { name: business.name, url: businessUrl(business.slug) },
  ];

  const amenities = business.amenities ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <JsonLd data={localBusinessLd(business)} />
      <Breadcrumbs items={crumbs} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div>
          {/* Trust card */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{business.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <VerificationBadge badge={business.verificationBadge} />
                  {business.isFeatured && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Featured
                    </span>
                  )}
                </div>
              </div>
              <StarRating rating={business.rating} reviewCount={business.reviewCount} size="lg" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {business.categories.map((bc) => (
                <Link
                  key={bc.categoryId}
                  href={categoryUrl(bc.category.slug)}
                  className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {bc.category.name}
                </Link>
              ))}
            </div>

            {/* CTAs */}
            <div className="mt-5 flex flex-wrap gap-3">
              {phoneHref && (
                <a
                  href={phoneHref}
                  className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white transition hover:bg-emerald-800"
                >
                  Call {business.phone}
                </a>
              )}
              {site && (
                <a
                  href={site}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="rounded-lg border border-stone-300 px-4 py-2 font-medium text-stone-700 transition hover:border-emerald-300 hover:text-emerald-800"
                >
                  Visit website
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          {business.description && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-stone-900">About</h2>
              <p className="mt-2 whitespace-pre-line text-stone-600">{business.description}</p>
            </section>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-stone-900">Amenities &amp; services</h2>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {amenities.map((a) => (
                  <li
                    key={a}
                    className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-stone-700 ring-1 ring-stone-200"
                  >
                    <span className="text-emerald-600">✓</span>
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Reviews */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-stone-900">Reviews</h2>
            {business.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">No reviews yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {business.reviews.map((r) => (
                  <li key={r.id} className="rounded-xl border border-stone-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-stone-800">{r.authorName}</span>
                      <span className="text-amber-500">{"★".repeat(r.rating)}</span>
                    </div>
                    {r.title && <p className="mt-1 font-medium text-stone-700">{r.title}</p>}
                    <p className="mt-1 text-sm text-stone-600">{r.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Location
            </h2>
            <p className="mt-2 text-stone-800">{business.address}</p>
            {site && (
              <p className="mt-2 text-sm">
                <a href={site} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-700 hover:underline">
                  {displayHostname(business.website)}
                </a>
              </p>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-emerald-700 hover:underline"
            >
              View on map →
            </a>
          </div>

          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            <p className="font-medium text-stone-800">Is this your business?</p>
            <p className="mt-1">Claim your listing to manage details and respond to reviews.</p>
            <Link href={`/business/${business.slug}/claim`} className="mt-2 inline-block font-medium text-emerald-700 hover:underline">
              Claim this business →
            </Link>
          </div>
        </aside>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-bold text-stone-900">
            Other listings in {business.location.name}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
