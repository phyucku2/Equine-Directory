import { notFound } from "next/navigation";
import { loadOwnedBusinessWithEntitlements } from "../_shared";
import { BoardingForm } from "./BoardingForm";
import { UpgradePrompt } from "../_facets/UpgradePrompt";
import type { PricingMap } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// Boarding & Pricing tab: board types, per-type pricing, openings/stalls/acreage,
// and the access policy. See specs/owner-profile-facets.md §4. Editing is gated
// behind the Verified plan (canEditFacets); display stays public regardless.
export default async function OwnerBoardingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadOwnedBusinessWithEntitlements(slug);
  if (!loaded) notFound();
  const { business, entitlements } = loaded;

  if (!entitlements.canEditFacets) {
    return (
      <div>
        <h3 className="mb-1 text-sm font-semibold text-pine">Boarding &amp; pricing</h3>
        <p className="mb-5 text-xs text-ink/50">
          Board types, pricing, and openings power your search filters.
        </p>
        <UpgradePrompt
          slug={business.slug}
          title="Editing facets is part of the Verified plan"
          body="Verify your barn to edit board types, pricing, disciplines, amenities, and more. Your crawled details stay visible to searchers in the meantime."
        />
      </div>
    );
  }

  const pricing =
    business.pricing && typeof business.pricing === "object" && !Array.isArray(business.pricing)
      ? (business.pricing as unknown as PricingMap)
      : {};

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Boarding & pricing</h3>
      <p className="mb-5 text-xs text-ink/50">
        What board you offer, what it costs, and how many openings you have. These
        power search filters and the boarding table on your public page.
      </p>
      <BoardingForm
        businessId={business.id}
        initial={{
          boardTypes: business.boardTypes ?? [],
          policies: business.policies ?? [],
          spotsAvailable: business.spotsAvailable,
          stallCount: business.stallCount,
          acreage: business.acreage,
          pricing,
        }}
      />
    </div>
  );
}
