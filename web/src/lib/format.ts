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

// Event date display. A single-day event shows one date; a multi-day range
// collapses same-month/year boundaries (e.g. "Jun 3–5, 2026", "Dec 30, 2026 – Jan 2, 2027").
const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const DATE_FMT_NO_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function formatEventDate(start: Date, end?: Date | null): string {
  if (!end || end.getTime() === start.getTime()) return DATE_FMT.format(start);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${DATE_FMT_NO_YEAR.format(start)}–${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${DATE_FMT_NO_YEAR.format(start)} – ${DATE_FMT.format(end)}`;
  }
  return `${DATE_FMT.format(start)} – ${DATE_FMT.format(end)}`;
}

export function formatPriceCents(cents?: number | null): string | null {
  if (cents == null) return null;
  if (cents === 0) return "Free";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: cents % 100 === 0 ? 0 : 2 })}`;
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
