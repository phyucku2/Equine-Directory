import { prisma } from "@/lib/prisma";
import { STABLES_SLUG } from "@/lib/db/business";
import { moderateAssignment, recomputePublished } from "@/lib/db/moderation";

// Number of independent open reports that auto-hides a business for triage.
export const REPORT_THRESHOLD = 3;

// Reasons a visitor can flag a listing. "not_a_stable" is the headline case
// (post-launch-fixes.md §4); the others are cheap extras the same button covers.
export const REPORT_REASONS = ["not_a_stable", "closed", "duplicate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

export interface CreateReportInput {
  businessId: string;
  reason: ReportReason;
  detail?: string | null;
  reporterIp?: string | null;
  reporterId?: string | null;
}

export type CreateReportResult =
  | { ok: false; error: "not_found" }
  | { ok: true; deduped: boolean; openCount: number; autoHidden: boolean };

// Record a report. Dedupes a repeat report from the same identity (ip or user),
// then — once independent open reports reach REPORT_THRESHOLD — auto-hides the
// business (isPublished=false) so it drops off the map/featured/search pending
// admin triage. Returns the open count so the API can respond.
export async function createReport(input: CreateReportInput): Promise<CreateReportResult> {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, isPublished: true },
  });
  if (!business) return { ok: false, error: "not_found" };

  // Dedupe: one open report per identity per business. Anonymous reports with no
  // ip and no user can't be deduped (rare on Vercel — x-forwarded-for is set).
  const identity: { reporterIp?: string; reporterId?: string }[] = [];
  if (input.reporterIp) identity.push({ reporterIp: input.reporterIp });
  if (input.reporterId) identity.push({ reporterId: input.reporterId });

  let deduped = false;
  if (identity.length > 0) {
    const existing = await prisma.report.findFirst({
      where: { businessId: input.businessId, status: "open", OR: identity },
      select: { id: true },
    });
    deduped = existing !== null;
  }

  if (!deduped) {
    await prisma.report.create({
      data: {
        businessId: input.businessId,
        reason: input.reason,
        detail: input.detail?.slice(0, 512) || null,
        reporterIp: input.reporterIp || null,
        reporterId: input.reporterId || null,
      },
    });
  }

  const openCount = await prisma.report.count({
    where: { businessId: input.businessId, status: "open" },
  });

  let autoHidden = false;
  if (openCount >= REPORT_THRESHOLD && business.isPublished) {
    await prisma.business.update({
      where: { id: input.businessId },
      data: { isPublished: false },
    });
    autoHidden = true;
  }

  return { ok: true, deduped, openCount, autoHidden };
}

export interface ReportedBusiness {
  businessId: string;
  name: string;
  slug: string;
  address: string;
  isPublished: boolean;
  openCount: number;
  reasons: { reason: string; count: number }[];
  lastReportedAt: Date;
}

// Businesses with at least one open report, most-reported first — the admin
// triage list (/admin/reports).
export async function listReportedBusinesses(limit = 100): Promise<ReportedBusiness[]> {
  const open = await prisma.report.findMany({
    where: { status: "open" },
    select: { businessId: true, reason: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (open.length === 0) return [];

  const byBusiness = new Map<
    string,
    { count: number; reasons: Map<string, number>; last: Date }
  >();
  for (const r of open) {
    const agg = byBusiness.get(r.businessId) ?? { count: 0, reasons: new Map(), last: r.createdAt };
    agg.count += 1;
    agg.reasons.set(r.reason, (agg.reasons.get(r.reason) ?? 0) + 1);
    if (r.createdAt > agg.last) agg.last = r.createdAt;
    byBusiness.set(r.businessId, agg);
  }

  const businesses = await prisma.business.findMany({
    where: { id: { in: [...byBusiness.keys()] } },
    select: { id: true, name: true, slug: true, address: true, isPublished: true },
  });
  const bizById = new Map(businesses.map((b) => [b.id, b]));

  return [...byBusiness.entries()]
    .map(([businessId, agg]) => {
      const b = bizById.get(businessId);
      return {
        businessId,
        name: b?.name ?? "(deleted)",
        slug: b?.slug ?? "",
        address: b?.address ?? "",
        isPublished: b?.isPublished ?? false,
        openCount: agg.count,
        reasons: [...agg.reasons.entries()].map(([reason, count]) => ({ reason, count })),
        lastReportedAt: agg.last,
      };
    })
    .sort((a, b) => b.openCount - a.openCount || b.lastReportedAt.getTime() - a.lastReportedAt.getTime())
    .slice(0, limit);
}

export type ReportAction = "dismiss" | "reject";

// Resolve a business's open reports.
//  - dismiss: reports were unfounded → close them and re-publish if the business
//    still has an approved category (a genuine barn reported in error).
//  - reject: confirmed not a stable → reject its boarding category (which
//    unpublishes via recomputePublished) and close the reports as actioned.
export async function resolveReports(
  businessId: string,
  action: ReportAction,
  reviewer: string,
): Promise<{ ok: true }> {
  await prisma.report.updateMany({
    where: { businessId, status: "open" },
    data: { status: action === "dismiss" ? "dismissed" : "actioned" },
  });

  if (action === "reject") {
    // Reject every published boarding category so a re-crawl can't re-publish it.
    const cats = await prisma.businessCategory.findMany({
      where: { businessId, category: { slug: STABLES_SLUG } },
      select: { categoryId: true },
    });
    for (const c of cats) {
      await moderateAssignment(businessId, c.categoryId, "reject", reviewer);
    }
  }

  // recompute either way (reject unpublishes; dismiss may re-publish a barn that
  // was auto-hidden at threshold).
  await recomputePublished(businessId);
  return { ok: true };
}
