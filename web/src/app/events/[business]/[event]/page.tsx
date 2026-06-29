import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getPublicEvent } from "@/lib/db/events";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { eventLd } from "@/lib/seo/jsonld";
import { formatEventDate, formatPriceCents, ensureHttp } from "@/lib/format";
import { PROGRAM_TYPES } from "@/lib/facets";
import { businessUrl, eventsUrl, eventUrl, absoluteUrl } from "@/lib/urls";

export const revalidate = 3600;

const PROGRAM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROGRAM_TYPES.map((p) => [p.slug, p.label]),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ business: string; event: string }>;
}): Promise<Metadata> {
  const { business, event } = await params;
  const data = await getPublicEvent(business, event);
  if (!data) return { title: "Event not found" };
  const title = `${data.title} — ${data.business.name}`;
  const description =
    data.description?.slice(0, 160) ??
    `${data.title} at ${data.business.name} on ${formatEventDate(data.startDate, data.endDate)}.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(eventUrl(business, event)) },
    openGraph: { title, description, type: "website" },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ business: string; event: string }>;
}) {
  const { business: businessSlug, event: eventSlug } = await params;
  const event = await getPublicEvent(businessSlug, eventSlug);
  if (!event) notFound();

  const price = formatPriceCents(event.price);
  const regUrl = ensureHttp(event.registrationUrl);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <JsonLd data={eventLd(event)} />
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          { name: "Events", url: eventsUrl() },
          { name: event.business.name, url: businessUrl(event.business.slug) },
          { name: event.title, url: eventUrl(event.business.slug, event.slug) },
        ]}
      />

      <article className="mt-6 overflow-hidden rounded-2xl border border-leather/15 bg-white">
        {event.imageUrl && (
          <div className="relative aspect-[16/9] w-full bg-cream-dark">
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              sizes="(max-width: 768px) 100vw, 700px"
              className="object-cover"
              priority
            />
          </div>
        )}
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brass">
            {PROGRAM_TYPE_LABELS[event.type] ?? event.type}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-pine sm:text-3xl">{event.title}</h1>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/55">When</dt>
              <dd className="mt-0.5 text-ink/80">
                {formatEventDate(event.startDate, event.endDate)}
              </dd>
            </div>
            {event.location && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink/55">Where</dt>
                <dd className="mt-0.5 text-ink/80">{event.location.name}, FL</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/55">Host</dt>
              <dd className="mt-0.5">
                <Link href={businessUrl(event.business.slug)} className="text-brass hover:underline">
                  {event.business.name}
                </Link>
              </dd>
            </div>
            {price && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink/55">Price</dt>
                <dd className="mt-0.5 text-ink/80">{price}</dd>
              </div>
            )}
          </dl>

          {event.description && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-pine">Details</h2>
              <p className="mt-2 whitespace-pre-line text-ink/70">{event.description}</p>
            </section>
          )}

          {regUrl && (
            <div className="mt-6">
              <a
                href={regUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-block rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light"
              >
                Register
              </a>
            </div>
          )}
        </div>
      </article>

      <p className="mt-6">
        <Link href={eventsUrl()} className="text-sm text-brass hover:underline">
          ← All events
        </Link>
      </p>
    </div>
  );
}
