// Indexability gate (tasks T18a, "noindex check" from the build workflow).
// Only confirmed, content-rich listings are indexable; thin/unverified pages
// get noindex,follow to protect E-E-A-T and avoid thin-content penalties.
// Non-indexable pages are also excluded from sitemaps.

import type { BusinessDetail } from "@/lib/db/business";

const MIN_DESCRIPTION_LEN = 120;

export interface MinIndexableBusiness {
  isPublished: boolean;
  verificationBadge: string;
  description: string | null;
  website: string | null;
  phone: string | null;
  reviewCount: number;
}

// A published business is publishable because it has >=1 grade-3/approved
// category. It becomes *indexable* once it also clears a content-quality bar.
export function isBusinessIndexable(b: MinIndexableBusiness): boolean {
  if (!b.isPublished) return false;
  if (b.verificationBadge && b.verificationBadge !== "UNVERIFIED") return true;
  const hasRichDescription = (b.description?.trim().length ?? 0) >= MIN_DESCRIPTION_LEN;
  const hasContact = Boolean(b.website || b.phone);
  return hasRichDescription && hasContact;
}

export function isBusinessDetailIndexable(b: BusinessDetail): boolean {
  return isBusinessIndexable(b);
}

// A hub/listing page is indexable only when it has content to show.
export function isHubIndexable(itemCount: number): boolean {
  return itemCount > 0;
}

export const ROBOTS_INDEX = "index,follow";
export const ROBOTS_NOINDEX = "noindex,follow";

export function robots(indexable: boolean): string {
  return indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX;
}
