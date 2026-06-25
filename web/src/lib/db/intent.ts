import { prisma } from "@/lib/prisma";

export interface IntentCombo {
  category: string;
  state: string;
  county: string;
  city: string;
}

// Distinct category × city combos that have at least one publishable listing.
// Used for static pre-rendering of intent pages; the long tail is ISR.
export async function getIntentCombos(limit = 200): Promise<IntentCombo[]> {
  const rows = await prisma.businessCategory.findMany({
    where: {
      reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] },
      business: { isPublished: true },
    },
    select: {
      category: { select: { slug: true } },
      business: {
        select: {
          location: {
            select: {
              slug: true,
              parent: { select: { slug: true, parent: { select: { slug: true } } } },
            },
          },
        },
      },
    },
    take: limit * 8,
  });

  const seen = new Map<string, IntentCombo>();
  for (const r of rows) {
    const city = r.business.location;
    const county = city.parent;
    const state = county?.parent;
    if (!county || !state) continue;
    const combo: IntentCombo = {
      category: r.category.slug,
      state: state.slug,
      county: county.slug,
      city: city.slug,
    };
    const key = `${combo.category}|${combo.city}`;
    if (!seen.has(key)) seen.set(key, combo);
    if (seen.size >= limit) break;
  }
  return Array.from(seen.values());
}
