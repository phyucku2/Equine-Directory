import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { loadOwnedBusiness } from "../_shared";
import { PhotosManager } from "./PhotosManager";

export const dynamic = "force-dynamic";

export default async function OwnerPhotosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

  const sub = await prisma.subscription.findUnique({ where: { businessId: business.id } });
  const ent = entitlementsFor(sub, business.attributes);

  // images are pre-sorted OWNER-first by ownerBusinessInclude; split for the UI.
  const owner = business.images
    .filter((i) => i.source === "OWNER")
    .map((i) => ({ id: i.id, url: i.url, source: i.source, rank: i.rank }));
  const other = business.images
    .filter((i) => i.source !== "OWNER")
    .map((i) => ({ id: i.id, url: i.url, source: i.source, rank: i.rank }));

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-pine">Photos</h3>
      <PhotosManager
        businessId={business.id}
        ownerPhotos={owner}
        otherPhotos={other}
        canUpload={ent.ownerPhotos}
        maxPhotos={ent.maxPhotos}
      />
    </div>
  );
}
