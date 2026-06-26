import Link from "next/link";
import Image from "next/image";
import type { BusinessCard as BusinessCardData } from "@/lib/db/business";
import { businessUrl } from "@/lib/urls";
import { StarRating } from "@/components/StarRating";
import { VerificationBadge } from "@/components/business/VerificationBadge";

export function BusinessCard({ business }: { business: BusinessCardData }) {
  const img = business.images[0];
  const primary = business.categories[0]?.category;
  const city = business.location;
  const county = business.location.parent;

  return (
    <Link
      href={businessUrl(business.slug)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-leather/15 bg-white shadow-sm transition hover:border-brass hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brass"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-cream-dark">
        {img ? (
          <Image
            src={img.url}
            alt={img.altText ?? business.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-leather/25">
            <svg viewBox="0 0 24 24" className="h-12 w-12" fill="currentColor" aria-hidden>
              <path d="M4 18V8l8-4 8 4v10h-5v-6H9v6H4z" />
            </svg>
          </div>
        )}
        {business.isFeatured && (
          <span className="absolute left-2 top-2 rounded-full bg-brass px-2 py-0.5 text-xs font-semibold text-pine">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-lg font-semibold text-pine group-hover:text-brass">
            {business.name}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge badge={business.verificationBadge} />
          {primary && (
            <span className="rounded-full bg-pine/5 px-2 py-0.5 text-xs text-pine">
              {primary.name}
            </span>
          )}
        </div>

        <p className="text-sm text-ink/55">
          {city.name}
          {county ? `, ${county.name.replace(" County", " Co.")}` : ""}
        </p>

        <div className="mt-auto pt-1">
          <StarRating rating={business.rating} reviewCount={business.reviewCount} />
        </div>
      </div>
    </Link>
  );
}
