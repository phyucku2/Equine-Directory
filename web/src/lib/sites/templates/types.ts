// Template contract for the Website Builder (specs/website-builder.md §Components).
//
// A `Template` is a small descriptor { id, name, render(props) }; the renderer
// (src/components/sites/SiteRenderer.tsx) picks one by `Site.templateId` and calls
// `render` with the resolved tenant content. `TemplateProps` is that resolved
// content — shaped from the live Business (+ images/trainers/events/reviews/
// location/facets) by getSiteContent() in src/lib/sites/content.ts, plus the
// owner's theme tokens and per-site copy (tagline/about) from `Site.pages`.
//
// Templates are React server components: they read only this plain, serializable
// shape (no Prisma models leak through), so each template stays a pure function of
// its props and sections render only when their data is present.

import type { ReactElement } from "react";
import type { ThemeTokens } from "@/lib/sites/palette";

/** A photo for hero / gallery use. */
export interface SiteImage {
  url: string;
  alt: string;
}

/** A board type with optional pricing, for the Boarding section. */
export interface SiteBoardOption {
  /** Display label (already resolved from the facet slug). */
  label: string;
  /** Monthly price range, pre-formatted (e.g. "from $450/mo"), or null. */
  price: string | null;
  /** What the price includes, if known. */
  included: string[];
}

/** A program / camp offering (summer camp, clinic, …). */
export interface SiteProgram {
  id: string;
  name: string;
  /** Resolved program-type label (e.g. "Summer camp"). */
  typeLabel: string;
  /** Pre-formatted price (e.g. "$300"), or null. */
  price: string | null;
  /** Free-text detail line ("Ages 8–14 · 12 spots"), or null. */
  detail: string | null;
}

/** A trainer profile surfaced on the Training/Lessons section. */
export interface SiteTrainer {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  disciplines: string[];
  certifications: string[];
}

/** A dated event / show / clinic / camp. */
export interface SiteEvent {
  id: string;
  title: string;
  /** Pre-formatted date or range (e.g. "Jun 3–5, 2026"). */
  dateLabel: string;
  description: string | null;
  /** Resolved type label (e.g. "Clinic"), or null. */
  typeLabel: string | null;
  /** Pre-formatted price ("$50" / "Free"), or null. */
  price: string | null;
  registrationUrl: string | null;
  imageUrl: string | null;
}

/** A published review with optional owner response. */
export interface SiteReview {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  content: string;
  ownerResponse: string | null;
}

/** Name / address / phone — the consistent NAP carried across the directory. */
export interface SiteContact {
  phone: string | null;
  /** `tel:` href derived from phone, or null. */
  phoneHref: string | null;
  email: string | null;
  /** Full single-line address. */
  address: string;
  /** Owner's own external website (not the generated site), or null. */
  website: string | null;
}

/** A grouped set of facet chips (disciplines, training, lessons, …). */
export interface SiteFacetGroup {
  /** Section/group heading (e.g. "Disciplines"). */
  label: string;
  /** Already-resolved chip labels. */
  values: string[];
}

/**
 * Fully-resolved tenant content handed to a template. Everything here is plain
 * and serializable; templates render purely from it. Optional/array fields are
 * empty when the underlying listing has no data, so templates can gate sections
 * on presence (`facets.length > 0`, `hero != null`, …).
 */
export interface TemplateProps {
  /** Business id (for keys / analytics; not rendered). */
  businessId: string;
  /** Barn name. */
  name: string;
  /** City, e.g. "Ocala". */
  city: string | null;
  /** Region/state name, e.g. "Florida". */
  region: string | null;
  /** Owner tagline (from Site.pages), or null. */
  tagline: string | null;
  /** Owner "About" story (from Site.pages), falling back to the listing description. */
  about: string | null;

  /** Theme tokens (primary/secondary/bg/text). */
  theme: ThemeTokens;
  /** Logo image, or null when the barn isn't entitled / has none. */
  logo: SiteImage | null;
  /** Hero image (best listing photo), or null. */
  hero: SiteImage | null;
  /** Remaining gallery photos. */
  gallery: SiteImage[];

  /** Contact / NAP block. */
  contact: SiteContact;
  /** Google Maps link for the address, or null. */
  mapHref: string | null;
  /** Human-readable weekday hours lines (e.g. "Monday: 9 AM–5 PM"). */
  hours: string[];

  /** Generic facet chip groups (disciplines, training, lessons, policies, …). */
  facets: SiteFacetGroup[];
  /** Boarding options + pricing. */
  boarding: SiteBoardOption[];
  /** Quick numeric facts (open spots / stalls / acreage), pre-formatted. */
  facts: { label: string; value: string }[];
  /** Programs / camps. */
  programs: SiteProgram[];
  /** Trainers. */
  trainers: SiteTrainer[];
  /** Upcoming events. */
  events: SiteEvent[];
  /** Approved reviews. */
  reviews: SiteReview[];
  /** Aggregate rating (e.g. "4.8"), or null when too few reviews. */
  rating: string | null;
  reviewCount: number;
}

/** A selectable template: a stable id, a display name, and its renderer. */
export interface Template {
  /** Stable id stored in `Site.templateId`. */
  id: string;
  /** Display name for the template gallery. */
  name: string;
  /** Render the resolved content as a full page. */
  render: (props: TemplateProps) => ReactElement;
}
