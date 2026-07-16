// Public catalog scope — the service verticals visitors can browse and filter
// (Goal 3: boarding, training, vets, farriers, tack, feed). This supersedes the
// stables-only V1 scoping; other crawled categories stay in the DB, hidden,
// until their data is verified.
//
// Client-safe: no Prisma/server imports, so map/filter UI components can share
// the exact same segment definitions the server queries use.

export interface ServiceSegment {
  /** Stable key used in UI state + URL params (?service=). */
  key: string;
  /** Chip / heading label. */
  label: string;
  /** Singular/plural noun for result counts ("12 stables", "3 vets"). */
  noun: [singular: string, plural: string];
  /** Category slugs (Category.slug) that make up this segment. */
  slugs: string[];
}

export const SERVICE_SEGMENTS: ServiceSegment[] = [
  { key: "boarding", label: "Boarding", noun: ["stable", "stables"], slugs: ["horse-boarding"] },
  {
    key: "training",
    label: "Training",
    noun: ["trainer", "trainers"],
    slugs: ["training-facilities", "trainer-instructor"],
  },
  { key: "vets", label: "Vets", noun: ["vet", "vets"], slugs: ["equine-veterinarian"] },
  { key: "farriers", label: "Farriers", noun: ["farrier", "farriers"], slugs: ["farrier"] },
  { key: "tack", label: "Tack", noun: ["tack store", "tack stores"], slugs: ["tack-shop"] },
  { key: "feed", label: "Feed", noun: ["feed store", "feed stores"], slugs: ["feed-forage"] },
  // Filled by the dedicated adjacent-verticals sweep (vets/farriers/trainers/
  // breeders) — without a segment here, crawled breeders would stay invisible.
  {
    key: "breeders",
    label: "Breeders",
    noun: ["breeder", "breeders"],
    slugs: ["breeding-facilities"],
  },
  // Owner decision (2026-07-15): tour/experience operators surfaced by the
  // crawl stay listed — under their own vertical rather than being culled.
  {
    key: "trailrides",
    label: "Trail Rides",
    noun: ["trail ride", "trail rides"],
    slugs: ["recreational-trail-guest-ranch"],
  },
];

/** Every publicly browsable category slug (union of the segments). */
export const PUBLIC_CATEGORY_SLUGS: string[] = SERVICE_SEGMENTS.flatMap((s) => s.slugs);

export function isPublicCategorySlug(slug: string): boolean {
  return PUBLIC_CATEGORY_SLUGS.includes(slug);
}

export function segmentByKey(key: string): ServiceSegment | undefined {
  return SERVICE_SEGMENTS.find((s) => s.key === key);
}

/** The segment a listing belongs to, from its (public) category slugs. */
export function segmentForSlugs(slugs: string[] | undefined): ServiceSegment | undefined {
  if (!slugs?.length) return undefined;
  return SERVICE_SEGMENTS.find((seg) => seg.slugs.some((s) => slugs.includes(s)));
}

/** Count noun for a segment key ("all" and unknown keys fall back to "results"). */
export function countNoun(key: string, count: number): string {
  const seg = segmentByKey(key);
  if (!seg) return count === 1 ? "result" : "results";
  return seg.noun[count === 1 ? 0 : 1];
}

// Lightweight free-text → segment matcher for "near me" search intent:
// "horseback riding near me" → the Trail Rides segment, "farrier near me" →
// Farriers, etc. Not a general classifier — just the service words people
// actually type. First match wins by list order, so multi-word phrases
// (trail rides, riding school) are listed before the bare words they contain.
const SEGMENT_SYNONYMS: { key: string; words: string[] }[] = [
  {
    key: "trailrides",
    words: ["horseback riding", "horse riding", "trail riding", "trail ride", "trail", "dude ranch", "guest ranch", "horseback"],
  },
  { key: "vets", words: ["veterinarian", "veterinary", "equine vet", "horse vet", "vet"] },
  { key: "farriers", words: ["farrier", "horseshoe", "hoof", "shoeing"] },
  { key: "tack", words: ["tack shop", "tack store", "tack", "saddlery", "saddle"] },
  { key: "feed", words: ["feed store", "feed", "hay", "forage", "grain"] },
  { key: "training", words: ["riding school", "riding lesson", "lessons", "lesson", "trainer", "training", "instructor"] },
  { key: "boarding", words: ["horse boarding", "boarding", "stables", "stable", "barn", "stall"] },
];

/** The service segment a free-text query is asking for, if any. */
export function matchSegment(text: string | undefined | null): ServiceSegment | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  for (const { key, words } of SEGMENT_SYNONYMS) {
    if (words.some((w) => t.includes(w))) return segmentByKey(key);
  }
  return undefined;
}
