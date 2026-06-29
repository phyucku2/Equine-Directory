// Owner-profile facet vocabulary — single source of truth (see
// specs/owner-profile-facets.md). Mirrored in crawler/equine_crawler/facets.py.
//
// Every filterable facet is a controlled vocabulary: { slug, label, group? }.
// Slugs are stable identifiers stored in the DB array columns; labels are display
// text. Filters, owner forms, and listing display all read from here so the
// vocabulary stays consistent across the app.

export type FacetOption = { slug: string; label: string; group?: string };

// ── Disciplines (shared by `disciplines` accepted + `trainingDisciplines`) ──
export const DISCIPLINES: FacetOption[] = [
  // English
  { slug: "dressage", label: "Dressage", group: "English" },
  { slug: "hunter-jumper", label: "Hunter/Jumper", group: "English" },
  { slug: "hunters", label: "Hunters", group: "English" },
  { slug: "jumpers", label: "Jumpers", group: "English" },
  { slug: "eventing", label: "Eventing", group: "English" },
  { slug: "equitation", label: "Equitation", group: "English" },
  { slug: "hunt-seat", label: "Hunt Seat", group: "English" },
  { slug: "saddle-seat", label: "Saddle Seat", group: "English" },
  // Western
  { slug: "reining", label: "Reining", group: "Western" },
  { slug: "cutting", label: "Cutting", group: "Western" },
  { slug: "cow-horse", label: "Cow Horse", group: "Western" },
  { slug: "roping", label: "Roping", group: "Western" },
  { slug: "barrel-racing", label: "Barrel Racing", group: "Western" },
  { slug: "western-pleasure", label: "Western Pleasure", group: "Western" },
  { slug: "ranch-riding", label: "Ranch Riding", group: "Western" },
  { slug: "horsemanship", label: "Horsemanship", group: "Western" },
  { slug: "working-cow", label: "Working Cow", group: "Western" },
  // Other
  { slug: "trail-pleasure", label: "Trail / Pleasure", group: "Other" },
  { slug: "endurance", label: "Endurance", group: "Other" },
  { slug: "driving", label: "Driving", group: "Other" },
  { slug: "gaited", label: "Gaited", group: "Other" },
  { slug: "polo", label: "Polo", group: "Other" },
  { slug: "vaulting", label: "Vaulting", group: "Other" },
  { slug: "sidesaddle", label: "Sidesaddle", group: "Other" },
  { slug: "mounted-shooting", label: "Mounted Shooting", group: "Other" },
  { slug: "therapeutic", label: "Therapeutic Riding", group: "Other" },
  // General
  { slug: "all-disciplines", label: "All Disciplines", group: "General" },
  { slug: "boarding-only", label: "Boarding Only", group: "General" },
];

// ── Board types ──
export const BOARD_TYPES: FacetOption[] = [
  { slug: "full", label: "Full Board" },
  { slug: "partial", label: "Partial Board" },
  { slug: "pasture", label: "Pasture / Field Board" },
  { slug: "self-care", label: "Self-Care" },
  { slug: "stall", label: "Stall Board" },
  { slug: "training-board", label: "Training Board" },
  { slug: "retirement", label: "Retirement Board" },
  { slug: "layup-rehab", label: "Layup / Rehab" },
];

// ── Training types ──
export const TRAINING_TYPES: FacetOption[] = [
  { slug: "full-training", label: "Full Training" },
  { slug: "training-rides", label: "Training Rides" },
  { slug: "colt-starting", label: "Colt Starting / Started" },
  { slug: "show-prep", label: "Show Prep & Coaching" },
  { slug: "sales-prep", label: "Sales Prep" },
  { slug: "tune-ups", label: "Tune-Ups" },
  { slug: "groundwork-restart", label: "Groundwork / Restart" },
  { slug: "conditioning-rehab", label: "Conditioning & Rehab" },
];

// ── Lesson levels ──
export const LESSON_LEVELS: FacetOption[] = [
  { slug: "beginner", label: "Beginner" },
  { slug: "intermediate", label: "Intermediate" },
  { slug: "advanced", label: "Advanced" },
  { slug: "lead-line", label: "Lead-Line / Up-Down" },
  { slug: "lesson-horses-available", label: "Lesson Horses Available" },
  { slug: "adult-programs", label: "Adult Programs" },
  { slug: "youth-programs", label: "Youth Programs" },
];

// ── Security & safety ──
export const SECURITY_FEATURES: FacetOption[] = [
  { slug: "security-cameras", label: "24/7 Security Cameras" },
  { slug: "gated-entry", label: "Gated Entry" },
  { slug: "coded-entry", label: "Coded / Keypad Entry" },
  { slug: "on-site-manager", label: "On-Site Manager" },
  { slug: "owner-on-site", label: "Owner Lives On-Site" },
  { slug: "overnight-staff", label: "Overnight Staff" },
  { slug: "perimeter-fencing", label: "Perimeter Fencing" },
  { slug: "barn-lighting", label: "Barn Lighting" },
  { slug: "arena-lighting", label: "Arena Lighting" },
  { slug: "fire-extinguishers", label: "Fire Extinguishers" },
  { slug: "sprinkler-system", label: "Sprinkler System" },
  { slug: "smoke-detectors", label: "Smoke Detectors" },
  { slug: "locked-tack-room", label: "Locked Tack Room" },
  { slug: "emergency-plan", label: "Emergency Plan" },
  { slug: "backup-generator", label: "Backup Generator" },
];

// ── Policies ──
export const POLICIES: FacetOption[] = [
  { slug: "open-barn", label: "Open Barn (outside trainers welcome)" },
  { slug: "closed-barn", label: "Closed Barn (in-house trainer only)" },
  { slug: "mares-only", label: "Mares Only" },
  { slug: "geldings-only", label: "Geldings Only" },
  { slug: "co-ed", label: "Co-Ed (mares & geldings)" },
  { slug: "stallions-accepted", label: "Stallions Accepted" },
  { slug: "no-stallions", label: "No Stallions" },
  { slug: "ada-accessible", label: "ADA Accessible" },
  { slug: "mounting-blocks", label: "Mounting Blocks" },
  { slug: "quarantine-available", label: "Quarantine Available" },
  { slug: "insurance-required", label: "Insurance Required" },
  { slug: "coggins-required", label: "Coggins Required" },
  { slug: "24-7-access", label: "24/7 Access" },
  { slug: "daylight-access-only", label: "Daylight Access Only" },
];

// ── Amenities (facility) — expanded vocabulary ──
export const AMENITIES: FacetOption[] = [
  { slug: "indoor-arena", label: "Indoor Arena", group: "Arenas" },
  { slug: "outdoor-arena", label: "Outdoor Arena", group: "Arenas" },
  { slug: "covered-arena", label: "Covered Arena", group: "Arenas" },
  { slug: "round-pen", label: "Round Pen", group: "Arenas" },
  { slug: "dressage-court", label: "Dressage Court", group: "Arenas" },
  { slug: "jumping-field", label: "Grass Jumping Field", group: "Arenas" },
  { slug: "hot-walker", label: "Hot Walker", group: "Conditioning" },
  { slug: "eurociser", label: "Eurociser", group: "Conditioning" },
  { slug: "treadmill", label: "Treadmill", group: "Conditioning" },
  { slug: "wash-rack", label: "Wash Rack", group: "Care" },
  { slug: "hot-water-wash", label: "Hot Water Wash Rack", group: "Care" },
  { slug: "grooming-stalls", label: "Grooming Stalls", group: "Care" },
  { slug: "cross-ties", label: "Cross Ties", group: "Care" },
  { slug: "tack-room", label: "Tack Room", group: "Care" },
  { slug: "tack-lockers", label: "Tack Lockers", group: "Care" },
  { slug: "heated-barn", label: "Heated Barn", group: "Barn" },
  { slug: "stall-fans", label: "Stall Fans", group: "Barn" },
  { slug: "auto-waterers", label: "Auto Waterers", group: "Barn" },
  { slug: "stall-mats", label: "Stall Mats", group: "Barn" },
  { slug: "run-in-sheds", label: "Run-In Sheds", group: "Turnout" },
  { slug: "individual-turnout", label: "Individual Turnout", group: "Turnout" },
  { slug: "group-turnout", label: "Group Turnout", group: "Turnout" },
  { slug: "grass-pasture", label: "Grass Pasture", group: "Turnout" },
  { slug: "dry-lot", label: "Dry Lot", group: "Turnout" },
  { slug: "trails-on-site", label: "Trails On-Site", group: "Grounds" },
  { slug: "trailer-parking", label: "Trailer Parking", group: "Grounds" },
  { slug: "viewing-lounge", label: "Viewing Lounge", group: "Comfort" },
  { slug: "observation-room", label: "Observation Room", group: "Comfort" },
  { slug: "restrooms", label: "Restrooms", group: "Comfort" },
  { slug: "rv-hookups", label: "RV Hookups", group: "Comfort" },
];

// ── Program types (programs[].type) ──
export const PROGRAM_TYPES: FacetOption[] = [
  { slug: "summer-camp", label: "Summer Camp" },
  { slug: "day-camp", label: "Day Camp" },
  { slug: "clinic", label: "Clinic" },
  { slug: "lease", label: "Lease Program" },
  { slug: "lessons", label: "Lesson Program" },
  { slug: "pony-party", label: "Pony Party" },
  { slug: "therapeutic", label: "Therapeutic Program" },
];

// Registry: maps a Business facet column → its vocabulary. The string[] columns
// here are validated/filtered against these lists.
export const FACETS = {
  disciplines: DISCIPLINES,
  trainingDisciplines: DISCIPLINES,
  boardTypes: BOARD_TYPES,
  trainingTypes: TRAINING_TYPES,
  lessonLevels: LESSON_LEVELS,
  securityFeatures: SECURITY_FEATURES,
  policies: POLICIES,
  amenities: AMENITIES,
} as const;

export type FacetKey = keyof typeof FACETS;

const SLUGS: Record<FacetKey, Set<string>> = Object.fromEntries(
  (Object.keys(FACETS) as FacetKey[]).map((k) => [k, new Set(FACETS[k].map((o) => o.slug))]),
) as Record<FacetKey, Set<string>>;

/** Keep only valid, de-duplicated slugs for a facet (order preserved). */
export function sanitizeFacet(key: FacetKey, values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s && SLUGS[key].has(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

const LABELS: Record<string, Record<string, string>> = Object.fromEntries(
  (Object.keys(FACETS) as FacetKey[]).map((k) => [
    k,
    Object.fromEntries(FACETS[k].map((o) => [o.slug, o.label])),
  ]),
);

/** Human label for a facet slug; falls back to the slug if unknown. */
export function facetLabel(key: FacetKey, slug: string): string {
  return LABELS[key]?.[slug] ?? slug;
}

/** Group a facet's options by their `group` (for sectioned chip pickers). */
export function groupedOptions(key: FacetKey): Record<string, FacetOption[]> {
  const out: Record<string, FacetOption[]> = {};
  for (const o of FACETS[key]) {
    const g = o.group ?? "";
    (out[g] ??= []).push(o);
  }
  return out;
}

export const PROGRAM_TYPE_SLUGS = new Set(PROGRAM_TYPES.map((p) => p.slug));
