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
  try {
    const businesses = await prisma.business.findMany({
      where: { isPublished: true },
      select: { slug: true },
      take: 500,
    });
    return businesses.map((b) => ({ slug: b.slug }));
  } catch {
    // DB unreachable at build time — fall back to on-demand ISR.
    return [];
  }
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
  const title = `${business.name} — ${cat ?? "Horse stable"} in ${business.location.name}, FL`;
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
  const mapsQuery = `${business.latitude},${business.longitude}`;
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`;

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
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 lg:pb-6">
      <JsonLd data={localBusinessLd(business)} />
      <Breadcrumbs items={crumbs} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div>
          {/* Trust card */}
          <div className="rounded-2xl border border-leather/15 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-serif text-2xl font-semibold text-pine sm:text-3xl">{business.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <VerificationBadge badge={business.verificationBadge} />
                  {business.isFeatured && (
                    <span className="rounded-full bg-brass/15 px-2 py-0.5 text-xs font-medium text-leather">
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
                  className="rounded-full bg-pine/5 px-3 py-1 text-sm text-pine hover:bg-brass/10 hover:text-brass"
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
                  className="rounded-lg bg-pine px-4 py-2 font-medium text-cream transition hover:bg-pine-light"
                >
                  Call {business.phone}
                </a>
              )}
              {site && (
                <a
                  href={site}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="rounded-lg border border-leather/25 px-4 py-2 font-medium text-pine transition hover:border-brass hover:text-brass"
                >
                  Visit website
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          {business.description && (
            <section className="mt-6">
              <h2 className="font-serif text-lg font-semibold text-pine">About</h2>
              <p className="mt-2 whitespace-pre-line text-ink/70">{business.description}</p>
            </section>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <section className="mt-6">
              <h2 className="font-serif text-lg font-semibold text-pine">Facilities &amp; amenities</h2>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {amenities.map((a) => (
                  <li
                    key={a}
                    className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-ink/70 ring-1 ring-leather/15"
                  >
                    <span className="text-brass">✓</span>
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Reviews */}
          <section className="mt-8">
            <h2 className="font-serif text-lg font-semibold text-pine">Reviews</h2>
            {business.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-ink/55">No reviews yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {business.reviews.map((r) => (
                  <li key={r.id} className="rounded-xl border border-leather/15 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-pine">{r.authorName}</span>
                      <span className="text-brass">{"★".repeat(r.rating)}</span>
                    </div>
                    {r.title && <p className="mt-1 font-medium text-ink/80">{r.title}</p>}
                    <p className="mt-1 text-sm text-ink/70">{r.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-leather/15 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/55">
              Location
            </h2>
            <p className="mt-2 text-ink/80">{business.address}</p>
            {site && (
              <p className="mt-2 text-sm">
                <a href={site} target="_blank" rel="noopener noreferrer nofollow" className="text-brass hover:underline">
                  {displayHostname(business.website)}
                </a>
              </p>
            )}
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-brass hover:underline"
            >
              View on map →
            </a>
          </div>

          <div className="rounded-2xl border border-dashed border-leather/25 bg-white p-5 text-sm text-ink/70">
            <p className="font-medium text-pine">Is this your stable?</p>
            <p className="mt-1">Claim your listing to manage details and respond to reviews.</p>
            <Link href={`/business/${business.slug}/claim`} className="mt-2 inline-block font-medium text-brass hover:underline">
              Claim this stable →
            </Link>
          </div>
        </aside>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 font-serif text-xl font-semibold text-pine">
            Other stables in {business.location.name}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky mobile action bar — thumb-reachable Call / Directions / Website */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-leather/15 bg-cream/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl gap-2">
          {phoneHref && (
            <a
              href={phoneHref}
              className="flex-1 rounded-lg bg-pine py-2.5 text-center font-semibold text-cream transition hover:bg-pine-light"
            >
              Call
            </a>
          )}
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-pine/30 py-2.5 text-center font-semibold text-pine transition hover:border-brass hover:text-brass"
          >
            Directions
          </a>
          {site && (
            <a
              href={site}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex-1 rounded-lg border border-pine/30 py-2.5 text-center font-semibold text-pine transition hover:border-brass hover:text-brass"
            >
              Website
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
