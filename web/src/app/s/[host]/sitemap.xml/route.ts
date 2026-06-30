// Per-tenant sitemap (specs/website-builder.md §SEO).
//
// The app's root sitemap (src/app/sitemap.ts) is for the directory and is
// host-agnostic, so a barn site needs its own. A generated site is a single
// themed page (sections render inline), so its sitemap is just the site origin.
// Emitted as a Route Handler because the URL is host-dependent (the metadata
// `sitemap.ts` convention generates a static, host-less file).
//
// Reachable at `<tenant-host>/sitemap.xml` once tenant traffic is rewritten to
// this route group, and directly at `/s/<host>/sitemap.xml` for verification.

import { resolveSiteByHost, isTenantHost } from "@/lib/sites/tenant";
import { siteOrigin } from "@/lib/sites/seo";

export const revalidate = 86400;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ host: string }> },
) {
  const { host: hostParam } = await params;
  const host = decodeURIComponent(hostParam || "").trim();

  let body = "";
  if (host && isTenantHost(host)) {
    try {
      const site = await resolveSiteByHost(host);
      if (site && site.status === "LIVE") {
        const origin = siteOrigin(site);
        body =
          `  <url>\n    <loc>${origin}/</loc>\n` +
          `    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
      }
    } catch {
      // DB unreachable — emit an empty (valid) urlset; it regenerates via ISR.
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}</urlset>\n`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
