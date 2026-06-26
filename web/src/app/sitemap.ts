import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { STABLES_BUSINESS_WHERE, STABLES_SLUG } from "@/lib/db/business";
import { businessUrl, categoryUrl, stateUrl, countyUrl, cityUrl, absoluteUrl } from "@/lib/urls";
import { isBusinessIndexable } from "@/lib/seo/indexing";

export const revalidate = 86400;

// Split sitemaps: /sitemap.xml is the index, sub-sitemaps at /sitemap/<id>.xml.
export async function generateSitemaps() {
  return [{ id: "businesses" }, { id: "categories" }, { id: "locations" }];
}

async function businessesSitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await prisma.business.findMany({
    where: STABLES_BUSINESS_WHERE,
    select: {
      slug: true,
      updatedAt: true,
      verificationBadge: true,
      description: true,
      website: true,
      phone: true,
      reviewCount: true,
      isPublished: true,
    },
  });
  return rows
    .filter((b) => isBusinessIndexable(b))
    .map((b) => ({
      url: absoluteUrl(businessUrl(b.slug)),
      lastModified: b.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
}

async function categoriesSitemap(): Promise<MetadataRoute.Sitemap> {
  // Only categories that have at least one publishable assignment.
  const grouped = await prisma.businessCategory.groupBy({
    by: ["categoryId"],
    where: { reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] }, business: { isPublished: true } },
    _count: { businessId: true },
  });
  const ids = grouped.map((g) => g.categoryId);
  const cats = await prisma.category.findMany({
    where: { id: { in: ids }, slug: STABLES_SLUG },
    select: { slug: true, updatedAt: true },
  });
  return cats.map((c) => ({
    url: absoluteUrl(categoryUrl(c.slug)),
    lastModified: c.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));
}

async function locationsSitemap(): Promise<MetadataRoute.Sitemap> {
  // Derive non-empty locations from published stables (city -> county -> state).
  const businesses = await prisma.business.findMany({
    where: STABLES_BUSINESS_WHERE,
    select: {
      location: {
        select: {
          slug: true,
          updatedAt: true,
          parent: {
            select: {
              slug: true,
              updatedAt: true,
              parent: { select: { slug: true, updatedAt: true } },
            },
          },
        },
      },
    },
  });

  const entries = new Map<string, { url: string; lastModified: Date }>();
  for (const b of businesses) {
    const city = b.location;
    const county = city.parent;
    const state = county?.parent;
    if (!county || !state) continue;
    const add = (url: string, d: Date) => {
      const prev = entries.get(url);
      if (!prev || prev.lastModified < d) entries.set(url, { url, lastModified: d });
    };
    add(absoluteUrl(stateUrl(state.slug)), state.updatedAt);
    add(absoluteUrl(countyUrl(state.slug, county.slug)), county.updatedAt);
    add(absoluteUrl(cityUrl(state.slug, county.slug, city.slug)), city.updatedAt);
  }
  return Array.from(entries.values()).map((e) => ({
    url: e.url,
    lastModified: e.lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}

export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  try {
    switch (id) {
      case "businesses":
        return await businessesSitemap();
      case "categories":
        return await categoriesSitemap();
      case "locations":
        return await locationsSitemap();
      default:
        return [];
    }
  } catch {
    // DB unreachable at build — emit an empty sitemap; it regenerates via ISR.
    return [];
  }
}
