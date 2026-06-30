// Tenant content loader for the Website Builder (specs/website-builder.md §Architecture).
//
// `getSiteContent(businessId, opts)` loads the live Business (+ images, location,
// trainers, events, reviews, facets) and shapes it into the plain `TemplateProps`
// a template renders from. Content is read straight from the listing so a managed
// site stays auto-current — no duplication. We reuse the existing detail include
// (businessDetailInclude), the entitlements resolver, facet labels, and the same
// formatting helpers the public detail page uses, so a barn's site mirrors its
// listing exactly.
//
// Node runtime only (Prisma + derivePaletteFromLogo's fetch/zlib).

import { prisma } from "@/lib/prisma";
import {
  businessDetailInclude,
  type BusinessDetail,
} from "@/lib/db/business";
import { getEntitlements } from "@/lib/entitlements";
import { getListingTrainers } from "@/lib/db/trainers";
import { getUpcomingEventsForBusiness } from "@/lib/db/events";
import { facetLabel, PROGRAM_TYPES, type FacetKey } from "@/lib/facets";
import {
  formatRating,
  formatEventDate,
  formatPriceCents,
  telHref,
  showRating,
} from "@/lib/format";
import { derivePaletteFromLogo, type ThemeTokens } from "@/lib/sites/palette";
import type {
  TemplateProps,
  SiteImage,
  SiteBoardOption,
  SiteProgram,
  SiteFacetGroup,
} from "@/lib/sites/templates/types";

type PriceEntry = { from: number | null; to: number | null; included: string[] };
type ProgramEntry = {
  id: string;
  type: string;
  name: string;
  season?: string;
  price?: number | null;
  ageRange?: string;
  capacity?: number | null;
};

const PROGRAM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROGRAM_TYPES.map((p) => [p.slug, p.label]),
);

const money = (n: number): string => `$${n.toLocaleString()}`;

/** Format a board-type pricing entry into a single label (mirrors the detail page). */
function priceLabel(p: PriceEntry): string | null {
  if (p.from != null && p.to != null && p.to !== p.from) return `${money(p.from)} – ${money(p.to)}/mo`;
  if (p.from != null) return `from ${money(p.from)}/mo`;
  if (p.to != null) return `up to ${money(p.to)}/mo`;
  return null;
}

/** Build a facet chip group from a facet column, or null when empty. */
function facetGroup(label: string, key: FacetKey, slugs: string[]): SiteFacetGroup | null {
  if (!slugs?.length) return null;
  return { label, values: slugs.map((s) => facetLabel(key, s)) };
}

/** Per-site copy stored in `Site.pages` (tagline / about). */
export interface SiteCopy {
  tagline?: string | null;
  about?: string | null;
}

/**
 * Best-effort parse of `Site.pages` JSON into the tagline/about copy a template
 * renders. Callers pass the result as `opts.copy` to getSiteContent().
 */
export function readSiteCopy(pages: unknown): SiteCopy {
  if (pages && typeof pages === "object" && !Array.isArray(pages)) {
    const p = pages as Record<string, unknown>;
    return {
      tagline: typeof p.tagline === "string" ? p.tagline : null,
      about: typeof p.about === "string" ? p.about : null,
    };
  }
  return {};
}

/** Read the colour tokens out of a `Site.theme` JSON value, when present. */
function readThemeTokens(theme: unknown): ThemeTokens | null {
  if (!theme || typeof theme !== "object") return null;
  const t = theme as Record<string, unknown>;
  // theme is { colors: {...}, font } per the spec; accept either shape.
  const colors =
    t.colors && typeof t.colors === "object" ? (t.colors as Record<string, unknown>) : t;
  const { primary, secondary, bg, text } = colors as Record<string, unknown>;
  if (
    typeof primary === "string" &&
    typeof secondary === "string" &&
    typeof bg === "string" &&
    typeof text === "string"
  ) {
    return { primary, secondary, bg, text };
  }
  return null;
}

export interface GetSiteContentOptions {
  /** Per-site copy (tagline/about) from `Site.pages`. */
  copy?: SiteCopy;
  /**
   * Saved theme from `Site.theme`. When omitted/invalid we derive a palette from
   * the logo so a brand-new draft still themes itself.
   */
  theme?: unknown;
  /** Clock injection for testing upcoming-event filtering. */
  now?: Date;
}

/**
 * Load + shape the tenant content for a Business into `TemplateProps`. Returns
 * null when the business is missing or not published. Sections come back empty
 * (not undefined) when the listing has no data, so templates can gate on length.
 */
export async function getSiteContent(
  businessId: string,
  opts: GetSiteContentOptions = {},
): Promise<TemplateProps | null> {
  const business = (await prisma.business.findFirst({
    where: { id: businessId, isPublished: true },
    include: businessDetailInclude,
  })) as BusinessDetail | null;
  if (!business) return null;

  const ent = getEntitlements(business);
  const now = opts.now ?? new Date();

  // Images: logo (entitled only) in the header; best non-logo photo is the hero,
  // the rest is the gallery. business.images is already source-sorted (OWNER first).
  const logoRow = ent.canLogo ? business.images.find((i) => i.isLogo) ?? null : null;
  const photos = business.images.filter((i) => !i.isLogo);
  const toImage = (i: { url: string; altText: string | null }): SiteImage => ({
    url: i.url,
    alt: i.altText ?? business.name,
  });
  const logo: SiteImage | null = logoRow ? toImage(logoRow) : null;
  const hero: SiteImage | null = photos[0] ? toImage(photos[0]) : null;
  const gallery: SiteImage[] = photos.slice(1).map(toImage);

  // Trainers (TEAM) + upcoming events (EVENTS), gated by entitlements. Both
  // helpers already enforce the entitlement and return [] when not eligible.
  const [trainerRows, eventRows] = await Promise.all([
    getListingTrainers(business.id, ent.maxTrainers, 12),
    getUpcomingEventsForBusiness(business.id, ent.canEvents, now, 12),
  ]);

  // Location / NAP.
  const city = business.location?.name ?? null;
  const region = business.location?.parent?.parent?.name ?? business.location?.parent?.name ?? null;
  const mapsQuery = `${business.latitude},${business.longitude}`;
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  // Hours (Google Places JSON shape: { weekdayDescriptions: [...] }).
  const hoursJson = business.hoursOfOperation as { weekdayDescriptions?: string[] } | null;
  const hours = Array.isArray(hoursJson?.weekdayDescriptions) ? hoursJson.weekdayDescriptions : [];

  // Facet chip groups (skip empties).
  const facets: SiteFacetGroup[] = [
    facetGroup("Disciplines", "disciplines", business.disciplines ?? []),
    facetGroup("Training", "trainingTypes", business.trainingTypes ?? []),
    facetGroup("Trains for", "trainingDisciplines", business.trainingDisciplines ?? []),
    facetGroup("Lessons", "lessonLevels", business.lessonLevels ?? []),
    facetGroup("Security & safety", "securityFeatures", business.securityFeatures ?? []),
    facetGroup("Policies", "policies", business.policies ?? []),
  ].filter((g): g is SiteFacetGroup => g != null);

  // Boarding + pricing.
  const pricing = (business.pricing ?? {}) as Record<string, PriceEntry>;
  const boardTypes = business.boardTypes ?? [];
  const boarding: SiteBoardOption[] = boardTypes.map((bt) => {
    const p = pricing[bt];
    return {
      label: facetLabel("boardTypes", bt),
      price: p ? priceLabel(p) : null,
      included: p?.included ?? [],
    };
  });

  const facts: { label: string; value: string }[] = [];
  if (business.spotsAvailable != null)
    facts.push({ label: "Open spots", value: String(business.spotsAvailable) });
  if (business.stallCount != null)
    facts.push({ label: "Stalls", value: String(business.stallCount) });
  if (business.acreage != null)
    facts.push({ label: "Acreage", value: `${business.acreage} ac` });

  // Programs / camps.
  const programRows = (Array.isArray(business.programs) ? business.programs : []) as ProgramEntry[];
  const programs: SiteProgram[] = programRows.map((p) => ({
    id: p.id,
    name: p.name,
    typeLabel: PROGRAM_TYPE_LABELS[p.type] ?? p.type,
    price: p.price != null ? money(p.price) : null,
    detail:
      [p.season, p.ageRange ? `Ages ${p.ageRange}` : null, p.capacity != null ? `${p.capacity} spots` : null]
        .filter(Boolean)
        .join(" · ") || null,
  }));

  // Theme: prefer the saved Site.theme, else derive from the logo (or fall back).
  const theme: ThemeTokens =
    readThemeTokens(opts.theme) ?? (await derivePaletteFromLogo(logo?.url));

  const copy = opts.copy ?? {};
  const rating = showRating(business.reviewCount) ? formatRating(business.rating) : null;

  return {
    businessId: business.id,
    name: business.name,
    city,
    region,
    tagline: copy.tagline ?? null,
    about: copy.about ?? business.description ?? null,

    theme,
    logo,
    hero,
    gallery,

    contact: {
      phone: business.phone ?? null,
      phoneHref: telHref(business.phone),
      email: business.email ?? null,
      address: business.address,
      website: business.website ?? null,
    },
    mapHref,
    hours,

    facets,
    boarding,
    facts,
    programs,
    trainers: trainerRows.map((t) => ({
      id: t.id,
      name: t.name,
      bio: t.bio,
      photoUrl: t.photoUrl,
      disciplines: t.disciplines ?? [],
      certifications: t.certifications ?? [],
    })),
    // eventRows are already published, upcoming and sorted soonest-first.
    events: eventRows.map((e) => ({
      id: e.id,
      title: e.title,
      dateLabel: formatEventDate(e.startDate, e.endDate),
      description: e.description,
      typeLabel: PROGRAM_TYPE_LABELS[e.type] ?? e.type ?? null,
      price: formatPriceCents(e.price),
      registrationUrl: e.registrationUrl,
      imageUrl: e.imageUrl,
    })),
    reviews: business.reviews.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: r.rating,
      title: r.title,
      content: r.content,
      ownerResponse: r.ownerResponse,
    })),
    rating,
    reviewCount: business.reviewCount,
  };
}
