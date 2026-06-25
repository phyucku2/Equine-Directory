import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/claim/verify", "/search"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
