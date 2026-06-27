import { notFound } from "next/navigation";
import { loadOwnedBusiness } from "../_shared";
import { DetailsForm } from "./DetailsForm";

export const dynamic = "force-dynamic";

export default async function OwnerDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

  const social = (business.socialLinks ?? {}) as Record<string, string>;

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-pine">Listing details</h3>
      <DetailsForm
        businessId={business.id}
        initial={{
          name: business.name,
          description: business.description ?? "",
          phone: business.phone ?? "",
          email: business.email ?? "",
          website: business.website ?? "",
          address: business.address,
          socialLinks: typeof social === "object" && !Array.isArray(social) ? social : {},
        }}
      />
    </div>
  );
}
