import { notFound } from "next/navigation";
import { loadOwnedBusiness } from "../_shared";
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
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-pine">Reviews &amp; inquiries</h3>
      <ReviewsInbox
        businessId={business.id}
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
          name: i.name,
          email: i.email,
          phone: i.phone,
          message: i.message,
          status: i.status,
          createdAt: i.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
