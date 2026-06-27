import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { listReviewsForUser } from "@/lib/db/review";
import { MyReviewsList } from "@/components/reviews/MyReviewsList";

// /account/reviews — the user's own reviews (M7 / §3). The account layout guards
// auth; requireUser() is a cheap second factor that also yields the user id.
export default async function MyReviewsPage() {
  const user = await requireUser();
  const reviews = await listReviewsForUser(user.id);

  const initial = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    content: r.content,
    isApproved: r.isApproved,
    ownerResponse: r.ownerResponse,
    createdAt: r.createdAt.toISOString(),
    business: r.business,
  }));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pine">Your reviews</h2>
          <p className="mt-0.5 text-sm text-ink/55">
            {reviews.length} {reviews.length === 1 ? "review" : "reviews"}.
          </p>
        </div>
        <Link href="/account" className="text-sm text-brass hover:underline">
          ← Back to account
        </Link>
      </div>
      <MyReviewsList initial={initial} />
    </div>
  );
}
