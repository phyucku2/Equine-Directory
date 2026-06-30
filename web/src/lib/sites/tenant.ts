// Tenant resolver for the Website Builder (specs/website-builder.md §Architecture).
//
// Maps a request `host` → the Site that should be rendered:
//   1. Exact match on Site.customDomain (the barn's own domain).
//   2. Otherwise the leftmost label is treated as a subdomain on our apex domain
//      (e.g. `oakridge.thestabledirectory.com` → subdomain "oakridge").
//
// The apex domain is derived from NEXT_PUBLIC_BASE_URL (so previews/staging work),
// falling back to SITE.domain ("thestabledirectory.com"). Requests on the apex
// itself (or its `www`) are the MAIN app, NOT a tenant.
//
// NOTE: this calls Prisma, so it must run on the Node runtime (route handlers /
// server components), NEVER inside edge middleware. Middleware only flags the
// tenant host via a header (see src/middleware.ts); the resolution happens here.

import type { Site } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";

/** Lowercase the host and strip any `:port` suffix and trailing dot. */
function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/\.$/, "") // strip FQDN trailing dot
    .split(":")[0]; // strip :port
}

/**
 * The apex domain tenant subdomains live under. Derived from
 * NEXT_PUBLIC_BASE_URL when set (covers staging/preview), else SITE.domain.
 */
export function getApexDomain(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (base) {
    try {
      return normalizeHost(new URL(base).host);
    } catch {
      // fall through to SITE.domain
    }
  }
  return normalizeHost(SITE.domain);
}

/**
 * Returns the tenant subdomain label for `host` if it is a subdomain of our
 * apex domain, else null. The bare apex and `www.<apex>` are the main app and
 * return null. `localhost`/IP hosts also return null.
 */
export function getSubdomain(host: string): string | null {
  const h = normalizeHost(host);
  const apex = getApexDomain();

  if (!h || h === apex) return null;

  // localhost / 127.0.0.1 / bare host with no apex match → main app.
  if (!h.endsWith(`.${apex}`)) return null;

  const label = h.slice(0, h.length - apex.length - 1); // drop ".<apex>"
  if (!label || label === "www") return null;
  // Only the single leftmost label is a tenant slug; deeper nesting is not ours.
  if (label.includes(".")) return null;
  return label;
}

/**
 * True when `host` should be served as a tenant site (custom domain OR a
 * subdomain of our apex), false when it is the main app. This is a cheap,
 * synchronous, DB-free check usable in edge middleware.
 */
export function isTenantHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  const apex = getApexDomain();
  // Main app: bare apex or www.<apex>.
  if (h === apex || h === `www.${apex}`) return false;
  // A subdomain of the apex → tenant.
  if (getSubdomain(h)) return true;
  // Any other registrable host is assumed to be a custom tenant domain. We do
  // NOT touch localhost / 127.* / bare-label dev hosts (those are the main app).
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false; // IPv4
  if (!h.includes(".")) return false; // single-label host → not a public domain
  return true;
}

/**
 * Resolve a request host to its Site, or null if none. Exact customDomain match
 * first, then subdomain on the apex. Suspended/draft sites are returned too —
 * callers decide how to handle status (e.g. show a "coming soon" for DRAFT).
 */
export async function resolveSiteByHost(host: string): Promise<Site | null> {
  const h = normalizeHost(host);
  if (!h) return null;

  // 1. Custom domain — exact match.
  const byCustom = await prisma.site.findUnique({ where: { customDomain: h } });
  if (byCustom) return byCustom;

  // 2. Subdomain on the apex.
  const subdomain = getSubdomain(h);
  if (!subdomain) return null;
  return prisma.site.findUnique({ where: { subdomain } });
}
