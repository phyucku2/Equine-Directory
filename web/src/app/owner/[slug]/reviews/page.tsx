import { notFound } from "next/navigation";
import { loadOwnedBusinessWithEntitlements } from "../_shared";
import { ReviewsInbox } from "./ReviewsInbox";

export const dynamic = "force-dynamic";

export default async function OwnerReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const loaded = await loadOwnedBusinessWithEntitlements(slug);
  if (!loaded) notFound();
  const { business, entitlements } = loaded;

  // Reading lead content is the Basic+ unlock (Zillow model). For FREE owners we
  // REDACT the PII server-side — the sender's name/email/phone/message never
  // reach the browser — so the paywall is real, not a CSS blur. The count + dates
  // still show, driving the "unlock your inquiries" upgrade.
  const leadsLocked = !entitlements.canReceiveLeads;

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-pine">Reviews &amp; inquiries</h3>
      <ReviewsInbox
        businessId={business.id}
        slug={business.slug}
        canRespond={entitlements.canCollectReviews}
        leadsLocked={leadsLocked}
        initialTab={tab === "inbox" ? "inbox" : "reviews"}
        reviews={business.reviews.map((r) => ({
          id: r.id,
          authorName: r.authorName,
          rating: r.rating,
          title: r.title,
          content: r.content,
          ownerResponse: r.ownerResponse,
          createdAt: r.createdAt.toISOString(),
          isApproved: r.isApproved,
        }))}
        inquiries={business.inquiries.map((i) => ({
          id: i.id,
          name: leadsLocked ? "" : i.name,
          email: leadsLocked ? "" : i.email,
          phone: leadsLocked ? null : i.phone,
          message: leadsLocked ? "" : i.message,
          status: i.status,
          createdAt: i.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
