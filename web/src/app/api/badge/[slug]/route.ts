import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Embeddable "Certified" badge (specs/website-builder.md §"Backlinks & Certified
// badge"). Barns paste a snippet on their own site; the <a> wrapper links back to
// their listing (the backlink), and this endpoint serves the seal as a cacheable
// server-rendered SVG. Honesty rules: stars render only from REAL aggregate data
// (≥3 reviews), and the "Certified" wording is reserved for verified barns —
// unverified ones get a neutral "Find us on" mark. No PII beyond the public name.

export const revalidate = 86400;

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
}

function badgeSvg(opts: { name: string; certified: boolean; rating: number | null; reviewCount: number }): string {
  const { name, certified, rating, reviewCount } = opts;
  const label = certified ? "CERTIFIED" : "FIND US ON";
  const showRating = rating != null && reviewCount >= 3;
  const ratingLine = showRating ? `★ ${rating!.toFixed(1)} · ${reviewCount} reviews` : null;
  const display = esc(name.length > 26 ? `${name.slice(0, 25)}…` : name);
  const height = ratingLine ? 74 : 60;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="${height}" viewBox="0 0 240 ${height}" role="img" aria-label="${esc(
    `${name} — ${certified ? "Certified by" : "Listed on"} The Stable Directory`,
  )}">
  <rect x="0.5" y="0.5" width="239" height="${height - 1}" rx="10" fill="#ffffff" stroke="#1e3a2f" stroke-opacity="0.25"/>
  <g transform="translate(12,${height / 2 - 14}) scale(1.15)">
    <path d="M5 3c1 3 2 4 4 4 1.5 0 2-1 4-1 3 0 5 3 5 7 0 4-2 8-6 8-1.5 0-2.5-1-2.5-2.5 0-2 2-2.5 2-4.5 0-1-1-2-2.5-2S8 11 8 13c0 3 2 4 2 6 0 1-1 2-2.5 2C4 21 3 16 3 11c0-4 1-6 2-8z" fill="#b08d57"/>
  </g>
  <text x="48" y="20" font-family="Georgia, 'Times New Roman', serif" font-size="9" letter-spacing="1.4" fill="#b08d57" font-weight="700">${label}</text>
  <text x="48" y="36" font-family="Georgia, 'Times New Roman', serif" font-size="13" fill="#1e3a2f" font-weight="700">${display}</text>
  ${
    ratingLine
      ? `<text x="48" y="52" font-family="Georgia, 'Times New Roman', serif" font-size="11" fill="#b08d57">${esc(ratingLine)}</text>
  <text x="48" y="${height - 8}" font-family="Georgia, 'Times New Roman', serif" font-size="8" fill="#1e3a2f" fill-opacity="0.55">THE STABLE DIRECTORY</text>`
      : `<text x="48" y="${height - 10}" font-family="Georgia, 'Times New Roman', serif" font-size="8" fill="#1e3a2f" fill-opacity="0.55">THE STABLE DIRECTORY</text>`
  }
</svg>`;
}

// GET /api/badge/[slug].svg — the [slug] param arrives with the .svg suffix.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = raw.replace(/\.svg$/i, "");
  const business = await prisma.business.findFirst({
    where: { slug, isPublished: true },
    select: { name: true, verificationBadge: true, rating: true, reviewCount: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const svg = badgeSvg({
    name: business.name,
    certified: business.verificationBadge !== "UNVERIFIED",
    rating: business.rating != null ? Number(business.rating) : null,
    reviewCount: business.reviewCount,
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // A day at the CDN; badges update lazily as ratings change.
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
