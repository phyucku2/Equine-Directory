// GET /api/badge/<slug>.svg — server-rendered "Certified" seal for a business
// (specs/website-builder.md §"Backlinks & Certified badge"). This is the backlink
// magnet: every claimed barn can copy a one-line <a><img></a> snippet (built by
// <BadgeSnippet>) that embeds this SVG and links back to our domain.
//
// The route segment is `[slug].svg`, so `slug` is the dynamic param and `.svg` is
// a literal suffix: a request to `/api/badge/foo.svg` resolves `{ slug: "foo" }`.
//
// No PII is ever rendered — only the barn name, its REAL aggregate rating, and its
// verification status. Two honest variants (chosen by `?variant=`):
//   • "seal"   — the Certified/Verified trust mark. Earned by claim + VERIFIED+
//                tier (resolved via getEntitlements). Default.
//   • "rating" — the barn's real aggregate stars + review count from the Business
//                row. Auto-updating. With too few reviews we fall back to the seal
//                wording (no fabricated stars, never a blanket 5-star).
//
// Output is `image/svg+xml`, cached hard at the edge (it only changes when the
// barn's rating / tier changes — minutes-fresh is fine for a badge).

import { prisma } from "@/lib/prisma";
import { getEntitlements } from "@/lib/entitlements";
import { showRating, formatRating } from "@/lib/format";

// SVG is static-ish content but depends on live DB state, so render per-request
// and lean on Cache-Control for the heavy lifting.
export const dynamic = "force-dynamic";

const STAR_PATH =
  "M10 1.5l2.6 5.27 5.82.846-4.21 4.104.994 5.794L10 14.99l-5.204 2.736.994-5.794L1.58 7.616l5.82-.846L10 1.5z";

// Theme tokens mirrored from the directory palette (pine / brass / cream / ink).
const COLORS = {
  pine: "#1f4733",
  pineLight: "#356b4d",
  brass: "#b08d3f",
  brassLight: "#d4b15f",
  cream: "#f7f3e8",
  creamDark: "#ece4cf",
  ink: "#1c1c1a",
} as const;

// Minimal XML-escape for any text we drop into the SVG (barn name is untrusted).
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function svgResponse(svg: string, maxAge: number): Response {
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Cacheable at the edge; a badge can lag the live row by a few minutes.
      // `stale-while-revalidate` keeps it instant while a fresh copy is fetched.
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
    },
  });
}

// Five stars with the first `filled` painted brass, the rest faint — exactly the
// rounded integer the directory's <StarRating> shows, never a blanket 5.
function starsMarkup(filled: number, x: number, y: number): string {
  let out = `<g transform="translate(${x} ${y})">`;
  for (let i = 0; i < 5; i++) {
    const fill = i < filled ? COLORS.brass : "rgba(176,141,63,0.22)";
    out += `<g transform="translate(${i * 22} 0) scale(1)"><path d="${STAR_PATH}" fill="${fill}"/></g>`;
  }
  out += `</g>`;
  return out;
}

// The shared seal medallion + wordmark used by both variants. `subtitle` is the
// honest second line (a rating or the verification status).
function sealSvg(name: string, headline: string, subtitle: string, stars: number | null): string {
  const width = 300;
  const height = 120;
  const ringCx = 60;
  const ringCy = 60;

  const subtitleMarkup =
    stars != null
      ? starsMarkup(stars, 110, 70)
      : `<text x="110" y="78" font-family="Georgia, 'Times New Roman', serif" font-size="13" fill="${COLORS.brassLight}">${esc(
          subtitle,
        )}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(
    headline,
  )} — ${esc(name)} on The Stable Directory">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${COLORS.pine}"/>
      <stop offset="1" stop-color="${COLORS.pineLight}"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.brassLight}"/>
      <stop offset="1" stop-color="${COLORS.brass}"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="url(#bg)" stroke="${
    COLORS.brass
  }" stroke-width="1"/>
  <!-- Seal medallion -->
  <circle cx="${ringCx}" cy="${ringCy}" r="38" fill="none" stroke="url(#ring)" stroke-width="3"/>
  <circle cx="${ringCx}" cy="${ringCy}" r="31" fill="none" stroke="${COLORS.brass}" stroke-width="1" opacity="0.5"/>
  <path d="M${ringCx} ${ringCy - 22} l5.5 11.1 12.2 1.77-8.85 8.62 2.09 12.17L${ringCx} ${
    ringCy + 5
  } l-10.9 5.73 2.09-12.17-8.85-8.62 12.2-1.77z" fill="url(#ring)"/>
  <!-- Wordmark -->
  <text x="110" y="40" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="700" fill="${
    COLORS.cream
  }">${esc(headline)}</text>
  <text x="110" y="56" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="10" letter-spacing="1.5" fill="${
    COLORS.creamDark
  }" opacity="0.85">THE STABLE DIRECTORY</text>
  ${subtitleMarkup}
</svg>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const variant = searchParams.get("variant") === "rating" ? "rating" : "seal";

  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      name: true,
      rating: true,
      reviewCount: true,
      // Relations getEntitlements() needs.
      subscription: true,
      spotlights: true,
      // Claim signal: an accepted ownership row means the barn is claimed.
      owners: { select: { id: true }, take: 1 },
    },
  });

  if (!business) {
    return new Response("not found", { status: 404 });
  }

  const entitlements = getEntitlements(business);
  const isClaimed = business.owners.length > 0;
  // The trust mark is earned by claim + a paying VERIFIED+ tier.
  const isCertified = isClaimed && entitlements.tier !== "FREE";

  // Live rating variant: only show real stars when there are enough reviews
  // (showRating gate). Otherwise fall back to the certified wording — never a
  // fabricated star count.
  if (variant === "rating" && showRating(business.reviewCount)) {
    const value = formatRating(business.rating);
    if (value) {
      const filled = Math.max(0, Math.min(5, Math.round(Number(value))));
      const svg = sealSvg(
        business.name,
        `${value} ★ Rated`,
        `${value} from ${business.reviewCount} reviews`,
        filled,
      );
      // Rating moves with reviews — keep this fresher than the static seal.
      return svgResponse(svg, 300);
    }
  }

  // Seal variant (default + low-review fallback).
  const headline = isCertified ? "Certified" : "Listed";
  const subtitle = isCertified ? "Verified barn" : "On The Stable Directory";
  const svg = sealSvg(business.name, headline, subtitle, null);
  return svgResponse(svg, 3600);
}
