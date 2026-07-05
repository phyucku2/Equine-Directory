import type { NextConfig } from "next";

// Public catalog category slugs (mirror of src/lib/catalog.ts — kept inline so
// next.config stays free of app-alias imports). Used to scope the intent-page
// 301s to real category prefixes only.
const CATEGORY_SLUGS = [
  "horse-boarding",
  "training-facilities",
  "trainer-instructor",
  "equine-veterinarian",
  "farrier",
  "tack-shop",
  "feed-forage",
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    // Crawled/owner images live on arbitrary HTTPS hosts; allow https remote
    // patterns. Tighten to specific CDNs once an image pipeline is in place.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // Next 16 blocks local image srcs with query strings unless allowlisted.
    // The Google Places photo proxy uses /api/place-photo?ref=… (ref varies per
    // image). Omitting `search` allows the query; the route validates `ref`.
    localPatterns: [{ pathname: "/api/place-photo" }],
  },
  async rewrites() {
    return {
      // /sitemap.xml is reserved by the app/sitemap.ts metadata route, which
      // (with generateSitemaps) serves only /sitemap/<id>.xml and 404s at the
      // index URL robots.txt advertises. beforeFiles wins over the reserved
      // route, mapping it onto the real index handler (app/sitemap-index.xml).
      beforeFiles: [{ source: "/sitemap.xml", destination: "/sitemap-index.xml" }],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    // Zillow-model URL flattening: county dropped from city + intent URLs.
    // Permanent 301s preserve every URL Google has already indexed.
    return [
      // Old city hub: /locations/[state]/[county]/[city] -> /locations/[state]/[city]
      {
        source: "/locations/:state/:county/:city",
        destination: "/locations/:state/:city",
        permanent: true,
      },
      // Old intent page: /[category]/[state]/[county]/[city] -> /[category]/[state]/[city]
      // One rule per real category slug so the 4-segment pattern can't match
      // unrelated routes.
      ...CATEGORY_SLUGS.map((slug) => ({
        source: `/${slug}/:state/:county/:city`,
        destination: `/${slug}/:state/:city`,
        permanent: true,
      })),
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
