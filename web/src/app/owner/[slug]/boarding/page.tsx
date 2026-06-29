import { notFound } from "next/navigation";
import { loadOwnedBusiness } from "../_shared";
import { BoardingForm } from "./BoardingForm";
import type { PricingMap } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// Boarding & Pricing tab: board types, per-type pricing, openings/stalls/acreage,
// and the access policy. See specs/owner-profile-facets.md §4.
export default async function OwnerBoardingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

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
