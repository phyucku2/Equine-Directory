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
      className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:border-emerald-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-100">
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
          <div className="flex h-full w-full items-center justify-center text-stone-300">
            <svg viewBox="0 0 24 24" className="h-12 w-12" fill="currentColor" aria-hidden>
              <path d="M4 18V8l8-4 8 4v10h-5v-6H9v6H4z" />
            </svg>
          </div>
        )}
        {business.isFeatured && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-h-[2.5rem] font-semibold text-stone-900 group-hover:text-emerald-800">
            {business.name}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge badge={business.verificationBadge} />
          {primary && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
              {primary.name}
            </span>
          )}
        </div>

        <p className="text-sm text-stone-500">
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
