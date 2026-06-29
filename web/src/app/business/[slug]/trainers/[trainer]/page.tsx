import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getBusinessTrainer } from "@/lib/db/trainers";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { trainerLd } from "@/lib/seo/jsonld";
import { facetLabel } from "@/lib/facets";
import { telHref } from "@/lib/format";
import { businessUrl, trainersUrl, trainerUrl, absoluteUrl } from "@/lib/urls";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; trainer: string }>;
}): Promise<Metadata> {
  const { slug, trainer } = await params;
  const data = await getBusinessTrainer(slug, trainer);
  if (!data) return { title: "Trainer not found" };
  const title = `${data.trainer.name} — Trainer at ${data.business.name}`;
  const description =
    data.trainer.bio?.slice(0, 160) ??
    `${data.trainer.name}, trainer at ${data.business.name}.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(trainerUrl(slug, trainer)) },
    openGraph: { title, description, type: "profile" },
  };
}

export default async function TrainerPage({
  params,
}: {
  params: Promise<{ slug: string; trainer: string }>;
}) {
  const { slug, trainer: trainerSlug } = await params;
  const data = await getBusinessTrainer(slug, trainerSlug);
  if (!data) notFound();
  const { business, trainer } = data;
  const phoneHref = telHref(trainer.phone);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <JsonLd data={trainerLd(trainer, business)} />
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          { name: business.name, url: businessUrl(business.slug) },
          { name: "Trainers", url: trainersUrl(business.slug) },
          { name: trainer.name, url: trainerUrl(business.slug, trainer.slug) },
        ]}
      />

      <div className="mt-6 rounded-2xl border border-leather/15 bg-white p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl bg-cream-dark ring-1 ring-leather/15">
            {trainer.photoUrl ? (
              <Image
                src={trainer.photoUrl}
                alt={trainer.name}
                fill
                sizes="128px"
                className="object-cover"
                priority
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-4xl font-semibold text-leather/30">
                {trainer.name.charAt(0)}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-pine">{trainer.name}</h1>
            <p className="mt-1 text-sm text-ink/55">
              Trainer at{" "}
              <Link href={businessUrl(business.slug)} className="text-brass hover:underline">
                {business.name}
              </Link>
            </p>
            {trainer.disciplines.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {trainer.disciplines.map((d) => (
                  <span
                    key={d}
                    className="rounded-full bg-pine/5 px-3 py-1 text-sm text-pine ring-1 ring-leather/15"
                  >
                    {facetLabel("disciplines", d)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {trainer.bio && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-pine">About</h2>
            <p className="mt-2 whitespace-pre-line text-ink/70">{trainer.bio}</p>
          </section>
        )}

        {trainer.certifications.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-pine">Certifications</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink/70">
              {trainer.certifications.map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <span className="text-brass">✓</span>
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(phoneHref || trainer.email) && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-pine">Contact</h2>
            <div className="mt-2 flex flex-wrap gap-3">
              {phoneHref && (
                <a
                  href={phoneHref}
                  className="rounded-lg bg-pine px-4 py-2 font-medium text-cream transition hover:bg-pine-light"
                >
                  Call {trainer.phone}
                </a>
              )}
              {trainer.email && (
                <a
                  href={`mailto:${trainer.email}`}
                  className="rounded-lg border border-leather/25 px-4 py-2 font-medium text-pine transition hover:border-brass hover:text-brass"
                >
                  Email
                </a>
              )}
            </div>
          </section>
        )}
      </div>

      <p className="mt-6">
        <Link href={trainersUrl(business.slug)} className="text-sm text-brass hover:underline">
          ← All trainers at {business.name}
        </Link>
      </p>
    </div>
  );
}
