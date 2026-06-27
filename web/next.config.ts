import type { NextConfig } from "next";

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
