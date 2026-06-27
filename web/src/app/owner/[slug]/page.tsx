import { notFound } from "next/navigation";
import Link from "next/link";
import { StableCard } from "@/components/stable/StableCard";
import { loadOwnedBusiness, toStableMarker } from "./_shared";

export const dynamic = "force-dynamic";

// Preview tab: the exact public StableCard, rendered from saved values, plus a
// quick-stats strip and jump links to the editors that fill it.
export default async function OwnerPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

  const marker = toStableMarker(business);
  const pendingReviews = business.reviews.filter(
    (r) => r.isApproved && !r.ownerResponse,
  ).length;
  const newInquiries = business.inquiries.filter((i) => i.status === "NEW").length;

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">
          How your listing appears
        </p>
        <StableCard s={marker} />
        <p className="mt-3 text-xs text-ink/45">
          This is the card shown in search results and on the map. Edit the{" "}
          <Link href={`/owner/${slug}/listing`} className="text-brass hover:underline">
            listing
          </Link>{" "}
          to change the offering, price, and amenities.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Reviews" value={business.reviewCount} />
          <Stat
            label="Rating"
            value={business.rating != null ? Number(business.rating).toFixed(1) : "—"}
          />
          <Stat
            label="Response rate"
            value={
              business.responseRate != null ? `${Math.round(Number(business.responseRate))}%` : "—"
            }
          />
          <Stat label="Photos" value={business.images.length} />
        </div>

        {(pendingReviews > 0 || newInquiries > 0) && (
          <div className="rounded-xl border border-brass/30 bg-brass/5 p-4">
            <p className="text-sm font-semibold text-pine">Needs your attention</p>
            <ul className="mt-2 space-y-1 text-sm text-ink/70">
              {pendingReviews > 0 && (
                <li>
                  {pendingReviews} review{pendingReviews === 1 ? "" : "s"} awaiting a reply ·{" "}
                  <Link href={`/owner/${slug}/reviews`} className="text-brass hover:underline">
                    respond
                  </Link>
                </li>
              )}
              {newInquiries > 0 && (
                <li>
                  {newInquiries} new inquir{newInquiries === 1 ? "y" : "ies"} ·{" "}
                  <Link href={`/owner/${slug}/reviews?tab=inbox`} className="text-brass hover:underline">
                    open inbox
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <EditLink slug={slug} seg="details" title="Details" desc="Name, contact, address, links" />
          <EditLink slug={slug} seg="listing" title="Listing" desc="Offering, price, amenities" />
          <EditLink slug={slug} seg="photos" title="Photos" desc="Upload, reorder, set cover" />
          <EditLink slug={slug} seg="hours" title="Hours" desc="Weekly hours of operation" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-leather/15 bg-white p-3 text-center">
      <p className="text-lg font-bold text-pine">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-ink/45">{label}</p>
    </div>
  );
}

function EditLink({
  slug,
  seg,
  title,
  desc,
}: {
  slug: string;
  seg: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={`/owner/${slug}/${seg}`}
      className="rounded-xl border border-leather/15 bg-white p-4 transition hover:border-brass/50"
    >
      <p className="text-sm font-semibold text-pine">{title}</p>
      <p className="mt-0.5 text-xs text-ink/55">{desc}</p>
    </Link>
  );
}
