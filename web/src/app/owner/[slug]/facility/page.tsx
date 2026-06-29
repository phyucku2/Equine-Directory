import { notFound } from "next/navigation";
import { loadOwnedBusinessWithEntitlements } from "../_shared";
import { FacilityForm } from "./FacilityForm";
import { UpgradePrompt } from "../_facets/UpgradePrompt";

export const dynamic = "force-dynamic";

// Facility & Security tab: amenities (expanded vocab), security features, and
// the general policies (excluding the trainer & access policies owned by other
// tabs). Editing is gated behind the Verified plan (canEditFacets).
export default async function OwnerFacilityPage({
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
        <h3 className="mb-1 text-sm font-semibold text-pine">Facility &amp; security</h3>
        <p className="mb-5 text-xs text-ink/50">
          Amenities, safety features, and barn policies power your search filters.
        </p>
        <UpgradePrompt
          slug={business.slug}
          title="Editing facets is part of the Verified plan"
          body="Verify your barn to edit amenities, security features, and policies. Your crawled details stay visible to searchers in the meantime."
        />
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Facility & security</h3>
      <p className="mb-5 text-xs text-ink/50">
        Amenities, safety features, and barn policies. These drive the amenity and
        safety filters and the facility section on your public page.
      </p>
      <FacilityForm
        businessId={business.id}
        initial={{
          amenities: business.amenities ?? [],
          securityFeatures: business.securityFeatures ?? [],
          policies: business.policies ?? [],
        }}
      />
    </div>
  );
}
