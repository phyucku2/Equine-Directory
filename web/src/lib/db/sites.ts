import { prisma } from "@/lib/prisma";
import { Prisma, type Site, type SiteStatus } from "@prisma/client";
import { derivePaletteFromLogo, type ThemeTokens } from "@/lib/sites/palette";
import { getApexDomain } from "@/lib/sites/tenant";
import { DEFAULT_TEMPLATE_ID, getTemplate } from "@/components/sites/templates/registry";

// Site data layer for the Website Builder (specs/website-builder.md §"Data model").
// Thin, server-only helpers the owner "Website" tab + admin provisioning call.
// Authorization (ownership / admin) is ALWAYS enforced upstream by the page —
// these helpers never read the session; they only touch the DB. `businessId`
// here always originates from an already-authorized boundary.
//
// A Site is pre-filled from the claimed listing: subdomain from the business
// slug, theme derived from the logo palette, the default template, and a default
// page selection. Content itself is read live from the Business at render time
// (see src/lib/sites/content.ts) — the Site only stores branding + structure.
//
// Node runtime only (Prisma + derivePaletteFromLogo's fetch/zlib).

// ─────────────────────────── Site.pages shape ───────────────────────────
// `pages` is a JSON blob: which sections render + their order, plus per-site copy
// (tagline / about). Content lives on the Business; this is structure + copy only.

/** The renderable sections a generated site can include, in default order. */
export const SITE_PAGE_SECTIONS = [
  "boarding",
  "facets",
  "programs",
  "trainers",
  "events",
  "gallery",
  "reviews",
  "contact",
] as const;
export type SitePageSection = (typeof SITE_PAGE_SECTIONS)[number];

const SECTION_SET = new Set<string>(SITE_PAGE_SECTIONS);

export interface SitePages {
  /** Ordered list of enabled sections. */
  sections: SitePageSection[];
  /** Owner tagline (rendered in the hero). */
  tagline: string | null;
  /** Owner "About" story (falls back to the listing description when unset). */
  about: string | null;
}

const MAX_TAGLINE = 160;
const MAX_ABOUT = 4000;

/** The default page selection for a fresh build (all sections, default order). */
export function defaultPages(): SitePages {
  return { sections: [...SITE_PAGE_SECTIONS], tagline: null, about: null };
}

/** Parse a stored `Site.pages` JSON value into the typed SitePages shape. */
export function readPages(pages: Prisma.JsonValue | null | undefined): SitePages {
  const base = defaultPages();
  if (!pages || typeof pages !== "object" || Array.isArray(pages)) return base;
  const p = pages as Record<string, unknown>;
  const sections = Array.isArray(p.sections)
    ? (p.sections.filter(
        (s): s is SitePageSection => typeof s === "string" && SECTION_SET.has(s),
      ) as SitePageSection[])
    : base.sections;
  return {
    // De-dupe while preserving the owner's order; empty selection falls back to all.
    sections: sections.length ? [...new Set(sections)] : base.sections,
    tagline: typeof p.tagline === "string" && p.tagline.trim() ? p.tagline.trim().slice(0, MAX_TAGLINE) : null,
    about: typeof p.about === "string" && p.about.trim() ? p.about.trim().slice(0, MAX_ABOUT) : null,
  };
}

/** Sanitize a partial pages patch from the client into a clean SitePages. */
export function sanitizePages(input: unknown, fallback: SitePages): SitePages {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fallback;
  const p = input as Record<string, unknown>;
  const sections = Array.isArray(p.sections)
    ? (p.sections.filter(
        (s): s is SitePageSection => typeof s === "string" && SECTION_SET.has(s),
      ) as SitePageSection[])
    : fallback.sections;
  const tagline =
    p.tagline === null
      ? null
      : typeof p.tagline === "string"
        ? p.tagline.trim().slice(0, MAX_TAGLINE) || null
        : fallback.tagline;
  const about =
    p.about === null
      ? null
      : typeof p.about === "string"
        ? p.about.trim().slice(0, MAX_ABOUT) || null
        : fallback.about;
  return { sections: sections.length ? [...new Set(sections)] : fallback.sections, tagline, about };
}

// ─────────────────────────── Read ───────────────────────────

/** The Site for a business, or null if no build has been started. */
export function getSiteForBusiness(businessId: string): Promise<Site | null> {
  return prisma.site.findUnique({ where: { businessId } });
}

// ─────────────────────────── Subdomain derivation ───────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// Subdomain labels we never hand out (collide with the main app / infra hosts).
const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "mail", "owner", "sites", "static", "assets",
  "cdn", "blog", "help", "support", "status", "dev", "staging",
]);

/**
 * Pick a free subdomain for a business: slug of its name/slug, suffixed -2, -3…
 * on collision (and when it would shadow a reserved label). Globally unique.
 */
export async function deriveSubdomain(seed: string): Promise<string> {
  const base = slugify(seed) || "barn";
  let candidate = RESERVED_SUBDOMAINS.has(base) ? `${base}-barn` : base;
  for (let i = 2; i < 1000; i++) {
    const taken = await prisma.site.findUnique({
      where: { subdomain: candidate },
      select: { id: true },
    });
    if (!taken && !RESERVED_SUBDOMAINS.has(candidate)) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ─────────────────────────── Create ───────────────────────────

/** Read the OWNER logo URL (if any) for palette derivation at build time. */
async function getLogoUrl(businessId: string): Promise<string | null> {
  const logo = await prisma.businessImage.findFirst({
    where: { businessId, source: "OWNER", isLogo: true },
    select: { url: true },
  });
  return logo?.url ?? null;
}

/**
 * Create a Site for a business, pre-filled from its listing:
 *   - subdomain ← business slug (globally unique),
 *   - theme ← palette derived from the logo (falls back to brand tokens),
 *   - templateId ← the default template,
 *   - pages ← the default section selection (tagline/about blank).
 *
 * Idempotent: if a Site already exists for the business it is returned as-is
 * (Site.businessId is unique). The site starts in DRAFT.
 */
export async function createSiteFromListing(businessId: string): Promise<Site> {
  const existing = await prisma.site.findUnique({ where: { businessId } });
  if (existing) return existing;

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { slug: true, name: true },
  });

  const [subdomain, logoUrl] = await Promise.all([
    deriveSubdomain(business.slug || business.name),
    getLogoUrl(businessId),
  ]);
  const theme: ThemeTokens = await derivePaletteFromLogo(logoUrl);

  return prisma.site.create({
    data: {
      businessId,
      subdomain,
      templateId: DEFAULT_TEMPLATE_ID,
      theme: { colors: theme } as unknown as Prisma.InputJsonValue,
      pages: defaultPages() as unknown as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });
}

// ─────────────────────────── Update ───────────────────────────

export interface UpdateSiteInput {
  /** Switch template; validated against the registry (unknown → default). */
  templateId?: string;
  /** Replace the theme tokens (stored under `{ colors }`). */
  theme?: ThemeTokens;
  /** Replace the page selection + copy (sanitized server-side). */
  pages?: SitePages;
  /** Lifecycle transition (owner publish, admin suspend, …). */
  status?: SiteStatus;
}

/**
 * Patch a Site. Only provided fields change. templateId is normalized through the
 * registry so an unknown id can never be persisted. Returns the updated Site, or
 * null when no Site exists for the business.
 */
export async function updateSite(
  businessId: string,
  input: UpdateSiteInput,
): Promise<Site | null> {
  const existing = await prisma.site.findUnique({ where: { businessId }, select: { id: true } });
  if (!existing) return null;

  const data: Prisma.SiteUpdateInput = {};
  if (input.templateId !== undefined) data.templateId = getTemplate(input.templateId).id;
  if (input.theme !== undefined)
    data.theme = { colors: input.theme } as unknown as Prisma.InputJsonValue;
  if (input.pages !== undefined)
    data.pages = input.pages as unknown as Prisma.InputJsonValue;
  if (input.status !== undefined) data.status = input.status;

  return prisma.site.update({ where: { businessId }, data });
}

/** Set just the lifecycle status (admin provision/suspend, owner publish). */
export function setSiteStatus(businessId: string, status: SiteStatus): Promise<Site> {
  return prisma.site.update({ where: { businessId }, data: { status } });
}

// ─────────────────────────── Custom domain ───────────────────────────

/** Normalize a typed-in custom domain (lowercase, strip scheme/path/port). */
export function normalizeCustomDomain(raw: string): string | null {
  let h = raw.trim().toLowerCase();
  if (!h) return null;
  h = h.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  // Must be a public, multi-label host (and not our own apex subdomain space).
  if (!h.includes(".") || h.endsWith(`.${getApexDomain()}`) || h === getApexDomain()) return null;
  if (!/^[a-z0-9.-]+$/.test(h)) return null;
  return h;
}

/**
 * Attach (or clear) a custom domain on a Site. Marks dnsManaged once a domain is
 * set (we manage DNS via nameserver delegation). Returns null when the domain is
 * already claimed by another Site, or the business has no Site.
 */
export async function setCustomDomain(
  businessId: string,
  domain: string | null,
): Promise<Site | null> {
  const existing = await prisma.site.findUnique({ where: { businessId }, select: { id: true } });
  if (!existing) return null;

  const normalized = domain ? normalizeCustomDomain(domain) : null;
  if (domain && !normalized) return null; // invalid input

  if (normalized) {
    const clash = await prisma.site.findUnique({
      where: { customDomain: normalized },
      select: { businessId: true },
    });
    if (clash && clash.businessId !== businessId) return null; // taken
  }

  return prisma.site.update({
    where: { businessId },
    data: {
      customDomain: normalized,
      dnsManaged: normalized != null,
    },
  });
}

// ─────────────────────────── Admin provisioning ───────────────────────────

export interface AdminSiteRow {
  id: string;
  businessId: string;
  subdomain: string;
  customDomain: string | null;
  templateId: string;
  status: SiteStatus;
  dnsManaged: boolean;
  createdAt: Date;
  business: { name: string; slug: string };
}

/** List all Sites (admin console), newest first, with their business name/slug. */
export async function listSites(): Promise<AdminSiteRow[]> {
  return prisma.site.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      businessId: true,
      subdomain: true,
      customDomain: true,
      templateId: true,
      status: true,
      dnsManaged: true,
      createdAt: true,
      business: { select: { name: true, slug: true } },
    },
  });
}
