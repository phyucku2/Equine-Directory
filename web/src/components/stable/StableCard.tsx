import Link from "next/link";
import { SaveHeartButton } from "@/components/saved/SaveHeartButton";
import { facetLabel } from "@/lib/facets";

// Shared stable listing card. Extracted from MapView so owner/account SERVER
// components can reuse it (the original was a non-exported local inside the
// "use client" MapView). Markup + props are identical to the original, plus an
// optional save-heart overlay (M5) shown when a `businessId` is available.

export type StableMarker = {
  /** Business id — present on account/saved cards and after the map saved-id
   *  merge; absent on the raw /api/map markers until that merge runs. */
  id?: string;
  slug: string;
  name: string;
  city: string;
  rating: number | null;
  reviewCount: number;
  image: string | null;
  featured: boolean;
  verified: boolean;
  offering: string;
  /** Primary category display name (e.g. "Farriers") from /api/map. */
  category?: string;
  /** Public catalog category slugs — drives the service-segment filter. */
  categorySlugs?: string[];
  priceFrom: number | null;
  amenities: string[];
  // Structured facets (owner-profile-facets.md). Optional so callers that build a
  // StableMarker without them (saved-stable grid, legacy map markers) still type.
  disciplines?: string[];
  boardTypes?: string[];
  securityFeatures?: string[];
  trainingTypes?: string[];
  policies?: string[];
  programTypes?: string[];
  spotsAvailable?: number | null;
  lng: number;
  lat: number;
};

function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (rating == null) return <span className="text-xs text-ink/45">No rating yet</span>;
  return (
    <span className="text-xs text-ink/60">
      <span className="text-brass">★</span> {rating.toFixed(1)}
      {count > 0 && <span className="text-ink/45"> ({count})</span>}
    </span>
  );
}

export function StableCard({
  s,
  selected,
  onHover,
  innerRef,
  saved,
}: {
  s: StableMarker;
  selected?: boolean;
  onHover?: () => void;
  innerRef?: (el: HTMLDivElement | null) => void;
  /** Whether the current user has favorited this stable (heart filled). */
  saved?: boolean;
}) {
  // Compact facet badges: top discipline, top board type, and a cameras flag.
  const topDiscipline = s.disciplines?.[0];
  const topBoardType = s.boardTypes?.[0];
  const hasCameras = s.securityFeatures?.includes("security-cameras") ?? false;
  const hasBadges = Boolean(topDiscipline || topBoardType || hasCameras);

  return (
    <div
      ref={innerRef}
      onMouseEnter={onHover}
      className={`relative overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        selected ? "border-brass ring-2 ring-brass" : "border-leather/15 hover:border-brass/50"
      }`}
    >
      {s.id && (
        <div className="absolute right-2 top-2 z-10">
          <SaveHeartButton businessId={s.id} slug={s.slug} initialSaved={saved} size="sm" />
        </div>
      )}
      <Link href={`/business/${s.slug}`} className="block">
        <div className="relative aspect-[16/10] w-full bg-cream-dark">
          {s.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image} alt={s.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-leather/30">
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor" aria-hidden>
                <path d="M4 18V8l8-4 8 4v10h-5v-6H9v6H4z" />
              </svg>
            </div>
          )}
          {/* Offering header on the listing (default "Stalls Available") */}
          <span className="absolute left-2 top-2 rounded-full bg-pine/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            {s.offering}
          </span>
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
            {s.priceFrom != null && (
              <p className="shrink-0 text-sm font-semibold text-ink">
                ${s.priceFrom.toLocaleString()}
                <span className="text-xs font-normal text-ink/50">/mo</span>
              </p>
            )}
          </div>
          <p className="truncate text-xs text-ink/55">{s.city}</p>
          <div className="mt-1">
            <Stars rating={s.rating} count={s.reviewCount} />
          </div>
          {hasBadges && (
            <div className="mt-2 flex flex-wrap gap-1">
              {topDiscipline && (
                <span className="rounded-full bg-brass/10 px-2 py-0.5 text-[11px] font-medium text-leather">
                  {facetLabel("disciplines", topDiscipline)}
                </span>
              )}
              {topBoardType && (
                <span className="rounded-full bg-pine/10 px-2 py-0.5 text-[11px] font-medium text-pine">
                  {facetLabel("boardTypes", topBoardType)}
                </span>
              )}
              {hasCameras && (
                <span className="rounded-full bg-pine/10 px-2 py-0.5 text-[11px] font-medium text-pine">
                  🎥 Cameras
                </span>
              )}
            </div>
          )}
          {s.amenities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {s.amenities.slice(0, 4).map((a) => (
                <span key={a} className="rounded-full bg-pine/5 px-2 py-0.5 text-[11px] text-pine">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
