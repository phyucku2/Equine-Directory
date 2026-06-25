import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBusinessBySlug } from "@/lib/db/business";
import { businessUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ClaimForm } from "./ClaimForm";

export const metadata: Metadata = {
  title: "Claim this business",
  robots: "noindex,follow",
};

export default async function ClaimBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          { name: business.name, url: businessUrl(business.slug) },
          { name: "Claim", url: `/business/${business.slug}/claim` },
        ]}
      />
      <h1 className="mt-4 text-3xl font-bold text-stone-900">Claim {business.name}</h1>
      <p className="mt-2 text-stone-600">
        Verify ownership to manage this listing&apos;s details, photos, and respond to reviews.
      </p>
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6">
        <ClaimForm businessId={business.id} />
      </div>
    </div>
  );
}
