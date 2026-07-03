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
