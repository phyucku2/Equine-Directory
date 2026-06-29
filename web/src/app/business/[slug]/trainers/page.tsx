import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getBusinessTrainers } from "@/lib/db/trainers";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TrainerCard } from "@/components/business/TrainerCard";
import { businessUrl, trainersUrl, absoluteUrl } from "@/lib/urls";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessTrainers(slug);
  if (!data) return { title: "Trainers not found" };
  const title = `Trainers at ${data.business.name}`;
  return {
    title,
    description: `Meet the trainers and instructors at ${data.business.name}.`,
    alternates: { canonical: absoluteUrl(trainersUrl(slug)) },
    openGraph: { title, type: "website" },
  };
}

export default async function TrainersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getBusinessTrainers(slug);
  if (!data) notFound();
  const { business, trainers } = data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          { name: business.name, url: businessUrl(business.slug) },
          { name: "Trainers", url: trainersUrl(business.slug) },
        ]}
      />
      <h1 className="mt-4 text-3xl font-semibold text-pine">Trainers at {business.name}</h1>
      <p className="mt-1 text-ink/55">
        {trainers.length} {trainers.length === 1 ? "trainer" : "trainers"}
      </p>

      {trainers.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center text-ink/55">
          No trainer profiles yet.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {trainers.map((t) => (
            <TrainerCard key={t.id} trainer={t} businessSlug={business.slug} />
          ))}
        </div>
      )}

      <p className="mt-8">
        <Link href={businessUrl(business.slug)} className="text-sm text-brass hover:underline">
          ← Back to {business.name}
        </Link>
      </p>
    </div>
  );
}
