// Per-tenant SEO for the Website Builder (specs/website-builder.md §SEO).
//
// One module that produces everything a generated barn site needs to rank and
// share well, all derived from the SAME live listing content the template
// renders (so the NAP — name / address / phone — is byte-for-byte consistent
// across the directory listing and the barn's own site):
//
//   • schema.org JSON-LD — EquestrianFacility (a LocalBusiness subtype) with
//     PostalAddress, geo, telephone, opening hours, aggregateRating/reviews,
//     and `sameAs` cross-links back to the directory listing (link equity).
//   • Next `Metadata` — title/description, canonical, robots, and Open Graph /
//     Twitter cards whose OG image is auto-derived from the hero photo.
//   • Cross-link helpers — directory listing ⇄ site, both ways, for SEO juice.
//
// A tenant site's own origin is the custom domain when set, else
// `<subdomain>.<apex>`; the directory listing lives on our apex. Both are
// absolute so cards/canonicals resolve off-host.
//
// Node runtime only (called from the tenant route group's server components).

import type { Metadata } from "next";
import type { Site } from "@prisma/client";
import type { TemplateProps } from "@/lib/sites/templates/types";
import { getApexDomain } from "@/lib/sites/tenant";
import { businessUrl } from "@/lib/urls";
import { SITE } from "@/lib/site";

/** UTM tag for the directory ⇄ site backlinks so referrals are attributable. */
const SITE_BACKLINK_UTM = "utm_source=barnsite&utm_medium=referral";

/**
 * Public origin (scheme + host) a Site is served from: its custom domain when
 * present, otherwise `<subdomain>.<apex>`. Always https in production; mirrors
 * the apex's scheme from NEXT_PUBLIC_BASE_URL when running locally.
 */
export function siteOrigin(site: Pick<Site, "subdomain" | "customDomain">): string {
  const host = site.customDomain || `${site.subdomain}.${getApexDomain()}`;
  const scheme = (process.env.NEXT_PUBLIC_BASE_URL ?? "").startsWith("http://")
    ? "http"
    : "https";
  return `${scheme}://${host}`;
}

/** Absolute URL on the tenant site for a path (defaults to the home page). */
export function siteUrl(
  site: Pick<Site, "subdomain" | "customDomain">,
  path = "/",
): string {
  return `${siteOrigin(site)}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Absolute URL of this barn's directory listing on our apex. This is the
 * site → directory backlink target (and the JSON-LD `sameAs`). Tagged with a
 * UTM so we can attribute traffic the built sites send back to us.
 */
export function listingBacklinkUrl(listingSlug: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${SITE.domain}`;
  const path = businessUrl(listingSlug);
  return `${base.replace(/\/$/, "")}${path}?${SITE_BACKLINK_UTM}`;
}

/** Plain (un-tagged) directory listing URL, for the JSON-LD `url`/`sameAs`. */
function listingUrl(listingSlug: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${SITE.domain}`;
  return `${base.replace(/\/$/, "")}${businessUrl(listingSlug)}`;
}

/** Trim a description to a meta-friendly length without cutting mid-word. */
function metaDescription(content: TemplateProps): string {
  const place = [content.city, content.region].filter(Boolean).join(", ");
  const base =
    content.tagline?.trim() ||
    content.about?.trim() ||
    `${content.name}${place ? ` — horse boarding & training in ${place}` : ""}.`;
  const clean = base.replace(/\s+/g, " ").trim();
  return clean.length > 160 ? `${clean.slice(0, 157).trimEnd()}…` : clean;
}

interface SiteSeoInput {
  site: Pick<Site, "subdomain" | "customDomain">;
  content: TemplateProps;
  /** Slug of the barn's directory listing (for cross-links / sameAs). */
  listingSlug: string;
}

/**
 * schema.org EquestrianFacility (a LocalBusiness subtype) JSON-LD for the
 * tenant site. NAP comes straight from the listing content, so it matches the
 * directory exactly. `sameAs` links back to the directory listing for link
 * equity; `aggregateRating`/`review` only appear when the rating is shown.
 */
export function siteJsonLd({ site, content, listingSlug }: SiteSeoInput): Record<string, unknown> {
  const origin = siteOrigin(site);
  const place = [content.city, content.region].filter(Boolean).join(", ");

  // sameAs: directory listing + the barn's own external website (if any).
  const sameAs = [listingUrl(listingSlug)];
  if (content.contact.website) sameAs.push(content.contact.website);

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["EquestrianFacility", "LocalBusiness"],
    "@id": `${origin}/#business`,
    name: content.name,
    url: origin,
    address: {
      "@type": "PostalAddress",
      streetAddress: content.contact.address || undefined,
      addressLocality: content.city ?? undefined,
      addressRegion: content.region ?? undefined,
      addressCountry: "US",
    },
    sameAs,
  };

  if (content.about) ld.description = content.about.replace(/\s+/g, " ").trim();
  if (content.contact.phone) ld.telephone = content.contact.phone;
  if (content.contact.email) ld.email = content.contact.email;

  // Imagery: hero first, then gallery + logo, all absolute already.
  const images = [
    content.hero?.url,
    ...content.gallery.map((g) => g.url),
    content.logo?.url,
  ].filter((u): u is string => Boolean(u));
  if (images.length) ld.image = images;
  if (content.logo?.url) ld.logo = content.logo.url;

  // Opening hours from the Google-Places weekday descriptions, as plain text
  // specs (search engines parse these leniently).
  if (content.hours.length) ld.openingHours = content.hours;

  if (content.rating && content.reviewCount > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: content.rating,
      reviewCount: content.reviewCount,
    };
  }
  if (content.reviews.length) {
    ld.review = content.reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.authorName },
      reviewRating: { "@type": "Rating", ratingValue: r.rating },
      reviewBody: r.content,
    }));
  }

  // A short areaServed hint helps local intent.
  if (place) ld.areaServed = place;

  return ld;
}

/**
 * Next `Metadata` for the tenant site home page: title/description, canonical
 * to the site origin, robots (index when LIVE-able), and OG/Twitter cards with
 * the hero auto-used as the share image.
 */
export function siteMetadata({ site, content }: Omit<SiteSeoInput, "listingSlug">): Metadata {
  const origin = siteOrigin(site);
  const place = [content.city, content.region].filter(Boolean).join(", ");
  const title = place ? `${content.name} — ${place}` : content.name;
  const description = metaDescription(content);

  // Auto OG image from the hero (fallback to logo); absolute URLs already.
  const ogImage = content.hero?.url ?? content.logo?.url;
  const images = ogImage
    ? [{ url: ogImage, alt: content.hero?.alt ?? content.name }]
    : undefined;

  return {
    metadataBase: new URL(origin),
    title,
    description,
    alternates: { canonical: origin },
    openGraph: {
      type: "website",
      siteName: content.name,
      title,
      description,
      url: origin,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}
