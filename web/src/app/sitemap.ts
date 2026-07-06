import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { PUBLIC_BUSINESS_WHERE, PUBLIC_CATEGORY_SLUGS } from "@/lib/db/business";
import { businessUrl, categoryUrl, stateUrl, countyUrl, cityUrl, eventUrl, eventsUrl, absoluteUrl } from "@/lib/urls";
import { isBusinessIndexable } from "@/lib/seo/indexing";
import { getEventsForSitemap } from "@/lib/db/events";
import { GUIDES } from "@/lib/guides";

export const revalidate = 86400;

// Split sitemaps: /sitemap.xml is the index, sub-sitemaps at /sitemap/<id>.xml.
export async function generateSitemaps() {
  return [
    { id: "businesses" },
    { id: "categories" },
    { id: "locations" },
    { id: "events" },
    { id: "guides" },
  ];
}

// Static editorial + data pages (Goal 5 long-tail content + linkable assets).
function guidesSitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/guides"), changeFrequency: "weekly" as const, priority: 0.6 },
    { url: absoluteUrl("/data"), changeFrequency: "weekly" as const, priority: 0.7 },
    ...GUIDES.map((g) => ({
      url: absoluteUrl(`/guides/${g.slug}`),
      lastModified: new Date(g.datePublished),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}

async function businessesSitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await prisma.business.findMany({
    where: PUBLIC_BUSINESS_WHERE,
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
    where: { id: { in: ids }, slug: { in: PUBLIC_CATEGORY_SLUGS } },
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
  // Derive non-empty locations from published listings (city -> county -> state).
  const businesses = await prisma.business.findMany({
    where: PUBLIC_BUSINESS_WHERE,
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
    add(absoluteUrl(cityUrl(state.slug, city.slug)), city.updatedAt);
  }
  return Array.from(entries.values()).map((e) => ({
    url: e.url,
    lastModified: e.lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}

// Published, currently-entitled events + the calendar index.
async function eventsSitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEventsForSitemap();
  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(eventsUrl()),
      changeFrequency: "daily" as const,
      priority: 0.6,
    },
  ];
  for (const e of events) {
    entries.push({
      url: absoluteUrl(eventUrl(e.business.slug, e.slug)),
      lastModified: e.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    });
  }
  return entries;
}

// Next 16: `id` arrives as a Promise and MUST be awaited. Destructuring it as a
// plain string made the switch compare a Promise object against the id strings,
// so every sub-sitemap silently fell through to `default: []` — production
// served valid-but-EMPTY urlsets for all five sitemaps until this was awaited.
export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  try {
    const id = await props.id;
    switch (id) {
      case "businesses":
        return await businessesSitemap();
      case "categories":
        return await categoriesSitemap();
      case "locations":
        return await locationsSitemap();
      case "events":
        return await eventsSitemap();
      case "guides":
        return guidesSitemap();
      default:
        return [];
    }
  } catch {
    // DB unreachable at build — emit an empty sitemap; it regenerates via ISR.
    return [];
  }
}
