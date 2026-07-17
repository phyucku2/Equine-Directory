import { prisma } from "@/lib/prisma";

// Items awaiting human review: grade 1 or 2 category assignments that the
// crawler/extractor could not auto-confirm (spec.md — category grading).
export async function listModerationQueue(limit = 100) {
  return prisma.businessCategory.findMany({
    where: {
      reviewStatus: "PENDING_REVIEW",
      grade: { in: ["GRADE_1_NOT", "GRADE_2_UNSURE"] },
    },
    include: {
      business: { select: { id: true, name: true, slug: true, website: true, address: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ grade: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
}

export async function moderationQueueCount(): Promise<number> {
  return prisma.businessCategory.count({
    where: {
      reviewStatus: "PENDING_REVIEW",
      grade: { in: ["GRADE_1_NOT", "GRADE_2_UNSURE"] },
    },
  });
}

// Recompute whether a business should be publicly listed: it must have at least
// one published (auto-approved or human-approved) category assignment.
export async function recomputePublished(businessId: string) {
  const publishable = await prisma.businessCategory.count({
    where: { businessId, reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] } },
  });
  await prisma.business.update({
    where: { id: businessId },
    data: { isPublished: publishable > 0 },
  });
}

export type ModerationAction = "approve" | "reject";

// Approve -> promote to confirmed/published. Reject -> hide that category.
export async function moderateAssignment(
  businessId: string,
  categoryId: string,
  action: ModerationAction,
  reviewer: string,
) {
  const existing = await prisma.businessCategory.findUnique({
    where: { businessId_categoryId: { businessId, categoryId } },
  });
  if (!existing) return null;

  await prisma.businessCategory.update({
    where: { businessId_categoryId: { businessId, categoryId } },
    data:
      action === "approve"
        ? {
            grade: "GRADE_3_CONFIRMED",
            gradeSource: "STAFF_VERIFIED",
            reviewStatus: "APPROVED",
            reviewedBy: reviewer,
            reviewedAt: new Date(),
          }
        : {
            reviewStatus: "REJECTED",
            gradeSource: "STAFF_VERIFIED",
            reviewedBy: reviewer,
            reviewedAt: new Date(),
          },
  });

  await prisma.auditLog.create({
    data: {
      action: action === "approve" ? "CATEGORY_APPROVED" : "CATEGORY_REJECTED",
      entityType: "BusinessCategory",
      entityId: `${businessId}:${categoryId}`,
      performedBy: reviewer,
    },
  });

  await recomputePublished(businessId);
  return { ok: true };
}

// Bulk-reject every PENDING category claim whose business name contains one of
// the given keywords (case-insensitive substring). Used to sweep the moderation
// holding queue of clearly-non-barn records — e.g. churches and equipment
// dealers that picked up a stray horse-boarding claim during the crawl. Only
// touches unconfirmed grade 1/2 claims, so it can't unpublish a verified barn;
// reuses moderateAssignment so each rejection is audit-logged and republished.
export async function bulkRejectByName(
  keywords: string[],
  reviewer: string,
): Promise<{ rejected: number; matched: number }> {
  if (keywords.length === 0) return { rejected: 0, matched: 0 };
  const rows = await prisma.businessCategory.findMany({
    where: {
      reviewStatus: "PENDING_REVIEW",
      grade: { in: ["GRADE_1_NOT", "GRADE_2_UNSURE"] },
      business: {
        OR: keywords.map((kw) => ({
          name: { contains: kw, mode: "insensitive" as const },
        })),
      },
    },
    select: { businessId: true, categoryId: true },
  });
  let rejected = 0;
  for (const r of rows) {
    const res = await moderateAssignment(r.businessId, r.categoryId, "reject", reviewer);
    if (res) rejected += 1;
  }
  return { rejected, matched: rows.length };
}
