// Display formatting helpers.

const MIN_REVIEWS_FOR_RATING = 3; // hide ratings until >=3 reviews (dossier appendix)

export function showRating(reviewCount: number): boolean {
  return reviewCount >= MIN_REVIEWS_FOR_RATING;
}

export function formatRating(rating: unknown): string | null {
  if (rating == null) return null;
  const n = Number(rating);
  if (Number.isNaN(n)) return null;
  return n.toFixed(1);
}

export function telHref(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function ensureHttp(url?: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function displayHostname(url?: string | null): string | null {
  const u = ensureHttp(url);
  if (!u) return null;
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const BADGE_LABEL: Record<string, string> = {
  UNVERIFIED: "Unverified",
  VERIFIED: "Verified",
  TRUSTED: "Trusted",
  PREMIUM: "Premium",
};

export function badgeLabel(badge: string): string {
  return BADGE_LABEL[badge] ?? "Unverified";
}
