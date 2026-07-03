import { notFound } from "next/navigation";
import { loadOwnedBusiness } from "../_shared";
import { absoluteUrl, businessUrl } from "@/lib/urls";
import { WebsitePanel } from "./WebsitePanel";

export const dynamic = "force-dynamic";

// Website tab (Goal 7 / specs/website-builder.md): the website-build lead form
// (productized $99–299 build + $49.99/yr maintenance) and the free embeddable
// Certified badge — every claimed barn's copy-paste backlink to its listing.
export default async function OwnerWebsitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

  const listingUrl = absoluteUrl(businessUrl(business.slug));
  const badgeUrl = absoluteUrl(`/api/badge/${business.slug}.svg`);

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Website</h3>
      <p className="mb-5 text-xs text-ink/50">
        Get a professional barn website built from your listing, or add your free directory badge
        to the site you already have.
      </p>
      <WebsitePanel
        businessId={business.id}
        businessName={business.name}
        listingUrl={listingUrl}
        badgeUrl={badgeUrl}
      />
    </div>
  );
}
