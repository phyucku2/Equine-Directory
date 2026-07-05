import { prisma } from "@/lib/prisma";
import type { LocationType } from "@prisma/client";

export async function getStateBySlug(slug: string) {
  return prisma.location.findFirst({ where: { slug, type: "STATE" } });
}

export async function getCountyBySlug(stateSlug: string, countySlug: string) {
  return prisma.location.findFirst({
    where: { slug: countySlug, type: "COUNTY", parent: { slug: stateSlug, type: "STATE" } },
    include: { parent: true },
  });
}

export async function getCityBySlug(stateSlug: string, countySlug: string, citySlug: string) {
  return prisma.location.findFirst({
    where: {
      slug: citySlug,
      type: "CITY",
      parent: { slug: countySlug, type: "COUNTY", parent: { slug: stateSlug, type: "STATE" } },
    },
    include: { parent: { include: { parent: true } } },
  });
}

// Flat-URL resolvers (Zillow-model): a city is addressed by (state, city) with no
// county in the path. A city slug can repeat across counties in one state (two
// "Springfield"s), so we resolve to the one with the most published listings —
// deterministic, and it makes the bare URL point at the place people mean.
export async function getCityInState(stateSlug: string, citySlug: string) {
  const cities = await prisma.location.findMany({
    where: {
      slug: citySlug,
      type: "CITY",
      parent: { type: "COUNTY", parent: { slug: stateSlug, type: "STATE" } },
    },
    include: {
      parent: { include: { parent: true } },
      _count: { select: { businesses: { where: { isPublished: true } } } },
    },
  });
  if (cities.length === 0) return null;
  cities.sort((a, b) => b._count.businesses - a._count.businesses);
  return cities[0];
}

export async function getCountyInState(stateSlug: string, countySlug: string) {
  return prisma.location.findFirst({
    where: { slug: countySlug, type: "COUNTY", parent: { slug: stateSlug, type: "STATE" } },
    include: { parent: true },
  });
}

export type ResolvedPlace =
  | { kind: "city"; loc: NonNullable<Awaited<ReturnType<typeof getCityInState>>> }
  | { kind: "county"; loc: NonNullable<Awaited<ReturnType<typeof getCountyInState>>> };

// Resolve a bare `/locations/[state]/[place]` slug. Cities win over counties on a
// slug collision (cities are the SEO-primary hub, and the common intent). The
// rare shadowed county — a county whose slug exactly matches a city in the same
// state — is reachable via its listings' city pages; acceptable for v1.
export async function getPlaceBySlug(
  stateSlug: string,
  placeSlug: string,
): Promise<ResolvedPlace | null> {
  const city = await getCityInState(stateSlug, placeSlug);
  if (city) return { kind: "city", loc: city };
  const county = await getCountyInState(stateSlug, placeSlug);
  if (county) return { kind: "county", loc: county };
  return null;
}

export async function getChildren(parentId: string, type?: LocationType) {
  return prisma.location.findMany({
    where: { parentId, ...(type ? { type } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function getAllStates() {
  return prisma.location.findMany({ where: { type: "STATE" }, orderBy: { name: "asc" } });
}
