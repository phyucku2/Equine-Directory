// Tenant-facing site page (specs/website-builder.md §Architecture + §SEO).
//
// Renders a barn's generated website for a given request host. The host arrives
// as the `[host]` route param (a future middleware rewrite maps a tenant request
// `barnname.thestabledirectory.com/…` → `/s/barnname.thestabledirectory.com/…`),
// and we also accept the `x-tenant-host` request header the edge middleware sets
// as a fallback, so the route resolves the right Site either way.
//
// Flow mirrors the directory detail page (src/app/business/[slug]/page.tsx):
//   resolveSiteByHost(host) → getSiteContent(businessId) → SiteRenderer,
// with generateMetadata + JSON-LD from the per-site SEO module. Sites that are
// not LIVE 404 to the public; missing/unpublished content 404s too.

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { resolveSiteByHost } from "@/lib/sites/tenant";
import { getSiteContent, readSiteCopy } from "@/lib/sites/content";
import { SiteRenderer } from "@/components/sites/SiteRenderer";
import { JsonLd } from "@/components/JsonLd";
import { siteJsonLd, siteMetadata, listingBacklinkUrl } from "@/lib/sites/seo";
import { SITE } from "@/lib/site";
import type { TemplateProps } from "@/lib/sites/templates/types";
import type { Site } from "@prisma/client";

// Tenant content is request-host dependent; render dynamically and revalidate
// the underlying listing data on the same cadence as the detail page.
export const revalidate = 3600;

const TENANT_HOST_HEADER = "x-tenant-host";

/** Resolve the effective host: the route param, falling back to the header. */
async function effectiveHost(hostParam: string): Promise<string> {
  const decoded = decodeURIComponent(hostParam || "").trim();
  if (decoded) return decoded;
  const h = await headers();
  return h.get(TENANT_HOST_HEADER)?.trim() ?? "";
}

/**
 * Load the Site (LIVE only for the public), its directory listing slug, and the
 * shaped template content. Returns null when nothing should be served publicly.
 */
async function loadTenant(
  hostParam: string,
): Promise<{ site: Site; content: TemplateProps; listingSlug: string } | null> {
  const host = await effectiveHost(hostParam);
  if (!host) return null;

  const site = await resolveSiteByHost(host);
  // Only LIVE sites are public; DRAFT/SUSPENDED 404 (owner preview is a separate
  // authenticated surface, not this public route).
  if (!site || site.status !== "LIVE") return null;

  const business = await prisma.business.findUnique({
    where: { id: site.businessId },
    select: { slug: true },
  });
  if (!business) return null;

  const content = await getSiteContent(site.businessId, {
    theme: site.theme,
    copy: readSiteCopy(site.pages),
  });
  if (!content) return null;

  return { site, content, listingSlug: business.slug };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Metadata> {
  const { host } = await params;
  const tenant = await loadTenant(host);
  if (!tenant) return { title: "Site not found", robots: "noindex,nofollow" };
  return siteMetadata({ site: tenant.site, content: tenant.content });
}

export default async function TenantSitePage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const tenant = await loadTenant(host);
  if (!tenant) notFound();

  const { site, content, listingSlug } = tenant;
  const place = [content.city, content.region].filter(Boolean).join(", ");
  // Local-keyword anchor for the dofollow backlink (link-equity flywheel).
  const backlinkAnchor = content.city
    ? `${content.city} horse boarding`
    : `Find ${content.name} on ${SITE.name}`;

  return (
    <>
      <JsonLd data={siteJsonLd({ site, content, listingSlug })} />
      <SiteRenderer templateId={site.templateId} content={content} />

      {/* Directory ⇄ site cross-link: a dofollow backlink to the listing with a
          local-keyword anchor. Themed from the site palette so it reads as part
          of the barn's footer rather than directory chrome. */}
      <div
        style={{ background: content.theme.bg, color: content.theme.text }}
        className="border-t border-black/5 px-6 py-6 text-center text-sm"
      >
        <a
          href={listingBacklinkUrl(listingSlug)}
          className="font-medium underline decoration-dotted underline-offset-4 hover:opacity-80"
        >
          {backlinkAnchor}
        </a>
        <span className="opacity-60">
          {" "}· {content.name}
          {place ? ` in ${place}` : ""} is listed on {SITE.name}
        </span>
      </div>
    </>
  );
}
