import { prisma } from "@/lib/prisma";
import { PUBLIC_CATEGORY_WHERE, PUBLIC_CATEGORY_SLUGS } from "@/lib/db/business";

export interface IntentCombo {
  category: string;
  state: string;
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
      city: city.slug,
    };
    // State-qualified so same-named cities in different states both pre-render.
    const key = `${combo.category}|${combo.state}|${combo.city}`;
    if (!seen.has(key)) seen.set(key, combo);
    if (seen.size >= limit) break;
  }
  return Array.from(seen.values());
}

// ── Category × STATE pillar layer (SEO Lever 2) ──────────────────────────────
// Statewide intent ("horse boarding in Texas") sits between the national
// category hub and the per-city intent pages. These helpers feed the
// /[category]/[state] pillar page, its internal-link mesh, and the sitemap.

export interface CategoryStateCombo {
  category: string;
  state: string;
}

/** Distinct (category, state) pairs that have >=1 publishable listing. */
export async function getCategoryStateCombos(limit = 400): Promise<CategoryStateCombo[]> {
  const rows = await prisma.businessCategory.findMany({
    where: {
      ...PUBLIC_CATEGORY_WHERE,
      category: { slug: { in: PUBLIC_CATEGORY_SLUGS } },
      business: { isPublished: true },
    },
    select: {
      category: { select: { slug: true } },
      business: {
        select: { location: { select: { parent: { select: { parent: { select: { slug: true } } } } } } },
      },
    },
    take: limit * 20,
  });
  const seen = new Map<string, CategoryStateCombo>();
  for (const r of rows) {
    const state = r.business.location.parent?.parent;
    if (!state) continue;
    const key = `${r.category.slug}|${state.slug}`;
    if (!seen.has(key)) seen.set(key, { category: r.category.slug, state: state.slug });
    if (seen.size >= limit) break;
  }
  return Array.from(seen.values());
}

export interface PlaceCount {
  slug: string;
  name: string;
  code: string | null;
  count: number;
}

/** Cities in a state with >=1 publishable listing in a category, by count desc. */
export async function getCategoryCitiesInState(
  categorySlug: string,
  stateSlug: string,
  limit = 60,
): Promise<PlaceCount[]> {
  const rows = await prisma.business.findMany({
    where: {
      isPublished: true,
      categories: { some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: categorySlug } } },
      location: { parent: { parent: { slug: stateSlug, type: "STATE" } } },
    },
    select: { location: { select: { slug: true, name: true } } },
  });
  const by = new Map<string, PlaceCount>();
  for (const r of rows) {
    const c = r.location;
    const prev = by.get(c.slug);
    if (prev) prev.count += 1;
    else by.set(c.slug, { slug: c.slug, name: c.name, code: null, count: 1 });
  }
  return Array.from(by.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Public categories that have >=1 publishable listing in a state, by count desc. */
export async function getCategoriesInState(stateSlug: string): Promise<PlaceCount[]> {
  const rows = await prisma.businessCategory.findMany({
    where: {
      ...PUBLIC_CATEGORY_WHERE,
      category: { slug: { in: PUBLIC_CATEGORY_SLUGS } },
      business: {
        isPublished: true,
        location: { parent: { parent: { slug: stateSlug, type: "STATE" } } },
      },
    },
    select: { category: { select: { slug: true, name: true } } },
  });
  const by = new Map<string, PlaceCount>();
  for (const r of rows) {
    const prev = by.get(r.category.slug);
    if (prev) prev.count += 1;
    else by.set(r.category.slug, { slug: r.category.slug, name: r.category.name, code: null, count: 1 });
  }
  return Array.from(by.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** States that have >=1 publishable listing in a category, by count desc. */
export async function getStatesForCategory(categorySlug: string, limit = 51): Promise<PlaceCount[]> {
  const rows = await prisma.business.findMany({
    where: {
      isPublished: true,
      categories: { some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: categorySlug } } },
      location: { parent: { parent: { type: "STATE" } } },
    },
    select: {
      location: {
        select: { parent: { select: { parent: { select: { slug: true, name: true, code: true } } } } },
      },
    },
  });
  const by = new Map<string, PlaceCount>();
  for (const r of rows) {
    const st = r.location.parent?.parent;
    if (!st) continue;
    const prev = by.get(st.slug);
    if (prev) prev.count += 1;
    else by.set(st.slug, { slug: st.slug, name: st.name, code: st.code ?? null, count: 1 });
  }
  return Array.from(by.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}
