import { prisma } from "@/lib/prisma";
import type { Trainer } from "@prisma/client";
import { getEntitlements } from "@/lib/entitlements";

// Public trainer data layer (specs/monetization-tiers.md §"Public display").
// Trainer pages are a TEAM-tier SEO surface. We only surface trainers for a barn
// whose entitlements still grant trainer seats (maxTrainers > 0) — a downgrade
// hides the public pages without deleting the rows.

export type PublicTrainer = Trainer;

// The barn (by slug) plus its public trainers, or null if the barn is missing /
// not published / no longer entitled to trainer profiles.
export async function getBusinessTrainers(slug: string): Promise<{
  business: { id: string; name: string; slug: string };
  trainers: PublicTrainer[];
} | null> {
  const business = await prisma.business.findFirst({
    where: { slug, isPublished: true },
    include: {
      subscription: true,
      spotlights: true,
      trainers: { orderBy: [{ rank: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!business) return null;
  if (getEntitlements(business).maxTrainers <= 0) return null;
  return {
    business: { id: business.id, name: business.name, slug: business.slug },
    trainers: business.trainers,
  };
}

// A single trainer by barn slug + trainer slug, with the barn context, or null.
export async function getBusinessTrainer(
  slug: string,
  trainerSlug: string,
): Promise<{
  business: { id: string; name: string; slug: string };
  trainer: PublicTrainer;
} | null> {
  const business = await prisma.business.findFirst({
    where: { slug, isPublished: true },
    include: {
      subscription: true,
      spotlights: true,
      trainers: { where: { slug: trainerSlug } },
    },
  });
  if (!business) return null;
  if (getEntitlements(business).maxTrainers <= 0) return null;
  const trainer = business.trainers[0];
  if (!trainer) return null;
  return {
    business: { id: business.id, name: business.name, slug: business.slug },
    trainer,
  };
}

// Trainers shown inline on the barn listing (capped). Returns [] when not
// entitled, so the listing simply omits the section.
export async function getListingTrainers(
  businessId: string,
  entitledMaxTrainers: number,
  take = 6,
): Promise<PublicTrainer[]> {
  if (entitledMaxTrainers <= 0) return [];
  return prisma.trainer.findMany({
    where: { businessId },
    orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
    take,
  });
}
