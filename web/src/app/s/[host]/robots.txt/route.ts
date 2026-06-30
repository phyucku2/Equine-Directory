// Per-tenant robots.txt (specs/website-builder.md §SEO).
//
// The directory's robots (src/app/robots.ts) advertises the directory sitemap;
// a barn site needs its own that points at the tenant sitemap and only allows
// indexing when the site is actually LIVE. Emitted as a Route Handler because
// the body is host-dependent.
//
// Reachable at `<tenant-host>/robots.txt` once tenant traffic is rewritten here,
// and directly at `/s/<host>/robots.txt` for verification.

import { resolveSiteByHost, isTenantHost } from "@/lib/sites/tenant";
import { siteOrigin } from "@/lib/sites/seo";

export const revalidate = 86400;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ host: string }> },
) {
  const { host: hostParam } = await params;
  const host = decodeURIComponent(hostParam || "").trim();

  let live = false;
  let origin = "";
  if (host && isTenantHost(host)) {
    try {
      const site = await resolveSiteByHost(host);
      if (site && site.status === "LIVE") {
        live = true;
        origin = siteOrigin(site);
      }
    } catch {
      // DB unreachable — fall through to the disallow-all default below.
    }
  }

  const body = live
    ? `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`
    : // Unknown / non-LIVE host: keep it out of the index.
      `User-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
