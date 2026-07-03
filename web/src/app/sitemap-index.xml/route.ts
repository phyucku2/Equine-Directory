import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/urls";

// Sitemap INDEX. robots.txt advertises /sitemap.xml, but Next reserves that
// exact path for the app/sitemap.ts metadata route — which, with
// generateSitemaps, only emits the sub-sitemaps at /sitemap/<id>.xml and 404s
// at /sitemap.xml itself. A route handler can't live at /sitemap.xml (build
// error: "Conflicting route and metadata"), so the index lives here and a
// beforeFiles rewrite in next.config.ts maps /sitemap.xml onto it. Keep the id
// list in sync with generateSitemaps.
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
