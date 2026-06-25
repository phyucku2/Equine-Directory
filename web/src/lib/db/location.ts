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

export async function getChildren(parentId: string, type?: LocationType) {
  return prisma.location.findMany({
    where: { parentId, ...(type ? { type } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function getAllStates() {
  return prisma.location.findMany({ where: { type: "STATE" }, orderBy: { name: "asc" } });
}
