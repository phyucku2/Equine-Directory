import Link from "next/link";
import { auth } from "@/auth";
import { listOwnedBusinesses } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// Owner dashboard home. The layout already enforced auth + at-least-one
// ownership, so here we just list the owned barns with their response backlog
// (unanswered reviews + new inquiries) and link into each barn's editor.
export default async function OwnerHomePage() {
  const session = await auth();
  const userId = session?.user?.id;
  const businesses = userId ? await listOwnedBusinesses(userId) : [];

  const totalBacklog = businesses.reduce(
    (n, b) => n + b.pendingReviewCount + b.newInquiryCount,
    0,
  );

  return (
    <div className="space-y-6">
      {totalBacklog > 0 && (
        <div className="rounded-xl border border-brass/30 bg-brass/5 px-4 py-3 text-sm text-ink">
          You have <span className="font-semibold text-pine">{totalBacklog}</span> item
          {totalBacklog === 1 ? "" : "s"} needing a response across your listings.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {businesses.map((b) => {
          const backlog = b.pendingReviewCount + b.newInquiryCount;
          return (
            <Link
              key={b.id}
              href={`/owner/${b.slug}`}
              className="group flex gap-4 rounded-xl border border-leather/15 bg-white p-4 transition hover:border-brass/50"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-cream-dark">
                {b.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-leather/30">
                    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden>
                      <path d="M4 18V8l8-4 8 4v10h-5v-6H9v6H4z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold text-pine group-hover:text-brass">{b.name}</p>
                  {b.verificationBadge !== "UNVERIFIED" && (
                    <span className="shrink-0 rounded-full bg-pine/10 px-2 py-0.5 text-[10px] font-semibold text-pine">
                      {b.verificationBadge}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-ink/55">
                  {b.rating != null ? `★ ${b.rating.toFixed(1)} · ` : ""}
                  {b.reviewCount} review{b.reviewCount === 1 ? "" : "s"}
                  {b.responseRate != null ? ` · ${Math.round(b.responseRate)}% response` : ""}
                </p>
                {backlog > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {b.pendingReviewCount > 0 && (
                      <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[11px] font-medium text-leather">
                        {b.pendingReviewCount} to reply
                      </span>
                    )}
                    {b.newInquiryCount > 0 && (
                      <span className="rounded-full bg-pine/10 px-2 py-0.5 text-[11px] font-medium text-pine">
                        {b.newInquiryCount} new inquir{b.newInquiryCount === 1 ? "y" : "ies"}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-ink/40">All caught up</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
