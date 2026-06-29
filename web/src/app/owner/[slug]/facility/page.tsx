import { notFound } from "next/navigation";
import { loadOwnedBusiness } from "../_shared";
import { FacilityForm } from "./FacilityForm";

export const dynamic = "force-dynamic";

// Facility & Security tab: amenities (expanded vocab), security features, and
// the general policies (excluding the trainer & access policies owned by other
// tabs).
export default async function OwnerFacilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

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
