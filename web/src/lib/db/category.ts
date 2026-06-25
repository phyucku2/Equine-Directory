import { prisma } from "@/lib/prisma";

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: { parent: true, children: { orderBy: { name: "asc" } } },
  });
}

export async function getTopLevelCategories() {
  return prisma.category.findMany({
    where: { parentId: null },
    include: { children: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function getAllCategorySlugs() {
  const cats = await prisma.category.findMany({ select: { slug: true } });
  return cats.map((c) => c.slug);
}

// Count of published businesses per category slug (for hub stat lines / tiles).
export async function getCategoryCounts(): Promise<Record<string, number>> {
  const rows = await prisma.businessCategory.groupBy({
    by: ["categoryId"],
    where: {
      reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] },
      business: { isPublished: true },
    },
    _count: { businessId: true },
  });
  const ids = rows.map((r) => r.categoryId);
  const cats = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true },
  });
  const slugById = new Map(cats.map((c) => [c.id, c.slug]));
  const out: Record<string, number> = {};
  for (const r of rows) {
    const slug = slugById.get(r.categoryId);
    if (slug) out[slug] = r._count.businessId;
  }
  return out;
}
