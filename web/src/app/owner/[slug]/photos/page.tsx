import { notFound } from "next/navigation";
import { loadOwnedBusinessWithEntitlements } from "../_shared";
import { getLogo, readStallsBadge } from "@/lib/db/owner";
import { PhotosManager } from "./PhotosManager";

export const dynamic = "force-dynamic";

export default async function OwnerPhotosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadOwnedBusinessWithEntitlements(slug);
  if (!loaded) notFound();
  const { business, entitlements } = loaded;

  const logo = await getLogo(business.id);

  // images are pre-sorted OWNER-first by ownerBusinessInclude; the logo lives in
  // BusinessImage too (isLogo:true) but is managed separately, so exclude it.
  const owner = business.images
    .filter((i) => i.source === "OWNER" && !i.isLogo)
    .map((i) => ({ id: i.id, url: i.url, source: i.source, rank: i.rank }));
  const other = business.images
    .filter((i) => i.source !== "OWNER")
    .map((i) => ({ id: i.id, url: i.url, source: i.source, rank: i.rank }));

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-pine">Photos</h3>
      <PhotosManager
        businessId={business.id}
        slug={business.slug}
        ownerPhotos={owner}
        otherPhotos={other}
        maxPhotos={entitlements.maxImages}
        canLogo={entitlements.canLogo}
        logoUrl={logo?.url ?? null}
        canStallsBadge={entitlements.stallsBadge}
        stallsBadgeOn={readStallsBadge(business.attributes)}
      />
    </div>
  );
}
