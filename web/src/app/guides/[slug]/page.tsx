import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GUIDES, getGuide } from "@/lib/guides";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { articleLd } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/urls";

export const revalidate = 86400;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guide not found" };
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: absoluteUrl(`/guides/${guide.slug}`) },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <JsonLd
        data={articleLd({
          title: guide.title,
          description: guide.description,
          url: `/guides/${guide.slug}`,
          datePublished: guide.datePublished,
        })}
      />
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/guides" },
          { name: guide.title, url: `/guides/${guide.slug}` },
        ]}
      />
      <article className="mt-4">
        <h1 className="text-3xl font-bold leading-tight text-pine">{guide.title}</h1>
        <p className="mt-2 text-ink/55">{guide.description}</p>
        {guide.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-xl font-semibold text-pine">{s.heading}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-3 text-[15px] leading-relaxed text-ink/75">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>

      <div className="mt-12 rounded-2xl bg-pine px-6 py-8 text-center text-cream">
        <p className="text-lg font-semibold">Ready to look?</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-cream/70">
          Compare stables, trainers, vets, farriers, and more near you — free.
        </p>
        <Link
          href="/map"
          className="mt-4 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream-dark"
        >
          Browse the map →
        </Link>
      </div>
    </div>
  );
}
