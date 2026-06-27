import { notFound } from "next/navigation";
import { loadOwnedBusiness, toStableMarker } from "../_shared";
import { ListingEditor } from "./ListingEditor";

export const dynamic = "force-dynamic";

// The card-driving screen: offering + price + amenities, with an inline live
// StableCard preview reflecting unsaved edits.
export default async function OwnerListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

  const attrs = (business.attributes ?? {}) as { offering?: string; priceFrom?: number };

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Listing card</h3>
      <p className="mb-5 text-xs text-ink/50">
        These fields fill the card shown in search results and on the map.
      </p>
      <ListingEditor
        businessId={business.id}
        baseMarker={toStableMarker(business)}
        initial={{
          offering: typeof attrs.offering === "string" ? attrs.offering : "Stalls Available",
          priceFrom: typeof attrs.priceFrom === "number" ? attrs.priceFrom : null,
          amenities: business.amenities ?? [],
        }}
      />
    </div>
  );
}
