import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getBusinessBySlug, getRelated } from "@/lib/db/business";
import { businessUrl, categoryUrl, countyUrl, stateUrl, cityUrl, absoluteUrl } from "@/lib/urls";
import { telHref, ensureHttp, displayHostname } from "@/lib/format";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Gallery } from "@/components/business/Gallery";
import { VerificationBadge } from "@/components/business/VerificationBadge";
import { StarRating } from "@/components/StarRating";
import { JsonLd } from "@/components/JsonLd";
import { localBusinessLd } from "@/lib/seo/jsonld";
import { robots, isBusinessDetailIndexable } from "@/lib/seo/indexing";
import { SaveHeartButton } from "@/components/saved/SaveHeartButton";
import { InquiryForm } from "@/components/inquiry/InquiryForm";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { facetLabel, PROGRAM_TYPES, type FacetKey } from "@/lib/facets";
import { getEntitlements } from "@/lib/entitlements";
import { readStallsBadge } from "@/lib/db/owner";
import { getListingTrainers } from "@/lib/db/trainers";
import { getUpcomingEventsForBusiness } from "@/lib/db/events";
import { BusinessLogo } from "@/components/business/BusinessLogo";
import { TrainerCard } from "@/components/business/TrainerCard";
import { EventListItem } from "@/components/events/EventListItem";
import { trainersUrl } from "@/lib/urls";

export const revalidate = 3600;

// ── Structured facet display (owner-profile-facets.md §5) ─────────────────────
// Read from the typed Business facet columns and render grouped sections, only
// when non-empty. Slugs → labels via facetLabel().

type PriceEntry = { from: number | null; to: number | null; included: string[] };
type ProgramEntry = {
  id: string;
  type: string;
  name: string;
  season?: string;
  price?: number | null;
  ageRange?: string;
  capacity?: number | null;
};

function money(n: number): string {
  return `$${n.toLocaleString()}`;
}

// PROGRAM_TYPES is not in the FACETS registry (facetLabel can't resolve it), so
// resolve program-type slugs → labels directly here.
const PROGRAM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROGRAM_TYPES.map((p) => [p.slug, p.label]),
);

// A section heading matching the page's existing `text-lg font-semibold text-pine`.
function FacetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-pine">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// Pine pill list used for the chip-style facet groups.
function ChipList({ facet, slugs }: { facet: FacetKey; slugs: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {slugs.map((slug) => (
        <span
          key={slug}
          className="rounded-full bg-pine/5 px-3 py-1 text-sm text-pine ring-1 ring-leather/15"
        >
          {facetLabel(facet, slug)}
        </span>
      ))}
    </div>
  );
}

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

  // Monetization entitlements drive the logo, stalls badge, review collection,
  // and the trainer/event surfaces (monetization-tiers.md §"Public display").
  const ent = getEntitlements(business);
  const logo = ent.canLogo ? business.images.find((i) => i.isLogo) ?? null : null;
  // Gallery shows real photos only (the logo lives in the header).
  const galleryImages = business.images.filter((i) => !i.isLogo);
  const showStallsBadge =
    ent.stallsBadge && readStallsBadge(business.attributes) && (business.spotsAvailable ?? 0) > 0;

  const [related, trainers, events] = await Promise.all([
    getRelated(business),
    getListingTrainers(business.id, ent.maxTrainers),
    getUpcomingEventsForBusiness(business.id, ent.canEvents),
  ]);
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

  // Structured facets (typed columns; rendered as grouped sections below).
  const disciplines = business.disciplines ?? [];
  const boardTypes = business.boardTypes ?? [];
  const trainingTypes = business.trainingTypes ?? [];
  const trainingDisciplines = business.trainingDisciplines ?? [];
  const lessonLevels = business.lessonLevels ?? [];
  const securityFeatures = business.securityFeatures ?? [];
  const policies = business.policies ?? [];
  const pricing = (business.pricing ?? {}) as Record<string, PriceEntry>;
  const programs = (Array.isArray(business.programs) ? business.programs : []) as ProgramEntry[];

  // Board types that have a pricing entry drive the pricing table rows; any
  // remaining selected board types render below the table as plain chips.
  const pricedBoardTypes = boardTypes.filter((bt) => pricing[bt]);
  const unpricedBoardTypes = boardTypes.filter((bt) => !pricing[bt]);
  const numericFacts: { label: string; value: string }[] = [];
  if (business.spotsAvailable != null)
    numericFacts.push({ label: "Open spots", value: String(business.spotsAvailable) });
  if (business.stallCount != null)
    numericFacts.push({ label: "Stalls", value: String(business.stallCount) });
  if (business.acreage != null)
    numericFacts.push({ label: "Acreage", value: `${business.acreage} ac` });
  const hasBoarding =
    boardTypes.length > 0 || numericFacts.length > 0 || Object.keys(pricing).length > 0;

  // Google Places enrichment (stored as JSON by the crawler).
  const hours = business.hoursOfOperation as { weekdayDescriptions?: string[] } | null;
  const weekdayHours = Array.isArray(hours?.weekdayDescriptions) ? hours.weekdayDescriptions : [];
  const attrs = (business.attributes ?? {}) as { googleMapsUri?: string };
  const googleHref = typeof attrs.googleMapsUri === "string" ? attrs.googleMapsUri : mapHref;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 lg:pb-6">
      <JsonLd data={localBusinessLd(business)} />
      <Breadcrumbs items={crumbs} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div>
          {galleryImages.length > 0 && (
            <div className="mb-6">
              <Gallery images={galleryImages} name={business.name} stallsBadge={showStallsBadge} />
            </div>
          )}

          {/* Trust card */}
          <div className="rounded-2xl border border-leather/15 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {logo && <BusinessLogo url={logo.url} name={business.name} />}
                <div>
                <h1 className="text-2xl font-semibold text-pine sm:text-3xl">{business.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <VerificationBadge badge={business.verificationBadge} />
                  {business.isFeatured && (
                    <span className="rounded-full bg-brass/15 px-2 py-0.5 text-xs font-medium text-leather">
                      Featured
                    </span>
                  )}
                </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-right">
                  <StarRating rating={business.rating} reviewCount={business.reviewCount} size="lg" />
                  {business.reviewCount > 0 && (
                    <a
                      href={googleHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-brass hover:underline"
                    >
                      on Google →
                    </a>
                  )}
                </div>
                <SaveHeartButton
                  businessId={business.id}
                  slug={business.slug}
                  size="lg"
                  withLabel
                  selfFetch
                />
              </div>
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
              <h2 className="text-lg font-semibold text-pine">About</h2>
              <p className="mt-2 whitespace-pre-line text-ink/70">{business.description}</p>
            </section>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-pine">Facilities &amp; amenities</h2>
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

          {/* Boarding & Pricing */}
          {hasBoarding && (
            <FacetSection title="Boarding &amp; pricing">
              {numericFacts.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-4">
                  {numericFacts.map((f) => (
                    <div key={f.label} className="text-sm">
                      <span className="font-semibold text-pine">{f.value}</span>{" "}
                      <span className="text-ink/55">{f.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {pricedBoardTypes.length > 0 && (
                <div className="overflow-hidden rounded-xl ring-1 ring-leather/15">
                  <table className="w-full text-sm">
                    <tbody>
                      {pricedBoardTypes.map((bt) => {
                        const p = pricing[bt];
                        const range =
                          p.from != null && p.to != null && p.to !== p.from
                            ? `${money(p.from)} – ${money(p.to)}`
                            : p.from != null
                              ? `from ${money(p.from)}`
                              : p.to != null
                                ? `up to ${money(p.to)}`
                                : "Call for pricing";
                        return (
                          <tr key={bt} className="border-b border-leather/10 last:border-0">
                            <td className="bg-white px-4 py-3 align-top">
                              <p className="font-medium text-pine">
                                {facetLabel("boardTypes", bt)}
                              </p>
                              {p.included.length > 0 && (
                                <p className="mt-1 text-xs text-ink/55">
                                  Includes: {p.included.join(", ")}
                                </p>
                              )}
                            </td>
                            <td className="whitespace-nowrap bg-white px-4 py-3 text-right align-top font-semibold text-ink">
                              {range}
                              {p.from != null && (
                                <span className="text-xs font-normal text-ink/50">/mo</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {unpricedBoardTypes.length > 0 && (
                <div className="mt-3">
                  <ChipList facet="boardTypes" slugs={unpricedBoardTypes} />
                </div>
              )}
            </FacetSection>
          )}

          {/* Disciplines */}
          {disciplines.length > 0 && (
            <FacetSection title="Disciplines">
              <ChipList facet="disciplines" slugs={disciplines} />
            </FacetSection>
          )}

          {/* Training & Lessons */}
          {(trainingTypes.length > 0 ||
            trainingDisciplines.length > 0 ||
            lessonLevels.length > 0) && (
            <FacetSection title="Training &amp; lessons">
              <div className="space-y-3">
                {trainingTypes.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
                      Training
                    </p>
                    <ChipList facet="trainingTypes" slugs={trainingTypes} />
                  </div>
                )}
                {trainingDisciplines.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
                      Trains for
                    </p>
                    <ChipList facet="trainingDisciplines" slugs={trainingDisciplines} />
                  </div>
                )}
                {lessonLevels.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
                      Lessons
                    </p>
                    <ChipList facet="lessonLevels" slugs={lessonLevels} />
                  </div>
                )}
              </div>
            </FacetSection>
          )}

          {/* Programs & Camps */}
          {programs.length > 0 && (
            <FacetSection title="Programs &amp; camps">
              <ul className="grid gap-3 sm:grid-cols-2">
                {programs.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl bg-white p-4 ring-1 ring-leather/15"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-pine">{p.name}</p>
                      {p.price != null && (
                        <span className="shrink-0 text-sm font-semibold text-ink">
                          {money(p.price)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-brass">
                      {PROGRAM_TYPE_LABELS[p.type] ?? p.type}
                    </p>
                    <p className="mt-1 text-xs text-ink/55">
                      {[
                        p.season,
                        p.ageRange ? `Ages ${p.ageRange}` : null,
                        p.capacity != null ? `${p.capacity} spots` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </FacetSection>
          )}

          {/* Security & Safety */}
          {securityFeatures.length > 0 && (
            <FacetSection title="Security &amp; safety">
              <ChipList facet="securityFeatures" slugs={securityFeatures} />
            </FacetSection>
          )}

          {/* Policies */}
          {policies.length > 0 && (
            <FacetSection title="Policies">
              <ChipList facet="policies" slugs={policies} />
            </FacetSection>
          )}

          {/* Trainers (TEAM tier) */}
          {trainers.length > 0 && (
            <section className="mt-8">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-pine">Trainers</h2>
                <Link href={trainersUrl(business.slug)} className="text-sm text-brass hover:underline">
                  View all →
                </Link>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {trainers.map((t) => (
                  <TrainerCard key={t.id} trainer={t} businessSlug={business.slug} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming events (EVENTS tier) */}
          {events.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-pine">Upcoming events</h2>
              <ul className="mt-4 space-y-3">
                {events.map((e) => (
                  <EventListItem key={e.id} event={e} />
                ))}
              </ul>
            </section>
          )}

          {/* Reviews */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-pine">Reviews</h2>
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
                    {r.ownerResponse && (
                      <div className="mt-3 rounded-lg bg-pine/5 p-3 ring-1 ring-leather/15">
                        <p className="text-xs font-semibold uppercase tracking-wide text-pine">
                          Response from {business.name}
                        </p>
                        <p className="mt-1 text-sm text-ink/70">{r.ownerResponse}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {/* "Leave a review" is shown only when the barn collects reviews
                (VERIFIED+). Display above stays public for everyone. */}
            {ent.canCollectReviews && (
              <div className="mt-6">
                <ReviewForm businessId={business.id} businessSlug={business.slug} />
              </div>
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

          {weekdayHours.length > 0 && (
            <div className="rounded-2xl border border-leather/15 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/55">Hours</h2>
              <ul className="mt-2 space-y-1 text-sm text-ink/75">
                {weekdayHours.map((d) => {
                  const [day, ...rest] = d.split(": ");
                  return (
                    <li key={d} className="flex justify-between gap-3">
                      <span className="text-ink/55">{day}</span>
                      <span className="text-right">{rest.join(": ")}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-leather/15 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/55">
              Contact this barn
            </h2>
            <p className="mt-1 text-sm text-ink/70">
              Send an inquiry and {business.name} will reply to your email.
            </p>
            <div className="mt-4">
              <InquiryForm businessId={business.id} businessName={business.name} />
            </div>
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
          <h2 className="mb-5 text-xl font-semibold text-pine">
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
