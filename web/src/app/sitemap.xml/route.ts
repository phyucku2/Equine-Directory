import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/urls";

// Sitemap INDEX at /sitemap.xml — the URL robots.txt advertises. Next's
// generateSitemaps (app/sitemap.ts) emits the sub-sitemaps at /sitemap/<id>.xml
// but does NOT produce an index for them, so without this route crawlers get a
// 404 at the advertised location. Keep the id list in sync with generateSitemaps.
const SITEMAP_IDS = ["businesses", "categories", "locations", "events", "guides"] as const;

export const revalidate = 86400;

export function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_IDS.map((id) => `  <sitemap><loc>${absoluteUrl(`/sitemap/${id}.xml`)}</loc></sitemap>`).join("\n")}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
