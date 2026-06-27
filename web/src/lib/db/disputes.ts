import { prisma } from "@/lib/prisma";

// Admin disputes (§2.4): claims that could not auto-verify (mismatched/absent
// business email) or that landed on a business which already has a primary owner.
// Admins resolve them by granting ownership to the chosen claimant or rejecting.

export interface DisputeItem {
  claimId: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessEmail: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  status: string;
  userId: string | null;
  hasPrimaryOwner: boolean;
  createdAt: Date;
}

/**
 * Open disputes: PENDING claims whose claimant email doesn't match the business
 * contact email (or the business has none), plus VERIFIED claims on a business
 * that already had a primary owner (ownership was withheld).
 */
export async function listDisputes(): Promise<DisputeItem[]> {
  const claims = await prisma.claimRequest.findMany({
    where: { status: { in: ["PENDING", "VERIFIED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          owners: { where: { isPrimary: true }, select: { id: true } },
        },
      },
      ownership: { select: { id: true } },
    },
  });

  return claims
    .filter((c) => {
      const businessEmail = c.business.email?.trim().toLowerCase() ?? null;
      const claimantEmail = c.ownerEmail.trim().toLowerCase();
      const emailMismatch = !businessEmail || businessEmail !== claimantEmail;
      const hasPrimary = c.business.owners.length > 0;
      if (c.status === "PENDING") return emailMismatch;
      // VERIFIED but no ownership row granted -> withheld dispute.
      return c.status === "VERIFIED" && hasPrimary && !c.ownership;
    })
    .map((c) => ({
      claimId: c.id,
      businessId: c.business.id,
      businessName: c.business.name,
      businessSlug: c.business.slug,
      businessEmail: c.business.email,
      ownerName: c.ownerName,
      ownerEmail: c.ownerEmail,
      ownerPhone: c.ownerPhone,
      status: c.status,
      userId: c.userId,
      hasPrimaryOwner: c.business.owners.length > 0,
      createdAt: c.createdAt,
    }));
}

export type ResolveDisputeResult =
  | { ok: false; reason: "not_found" | "no_user" }
  | { ok: true; action: "granted" | "rejected" };

/**
 * Resolve a dispute. `grant` makes the claim's user the (new) primary owner,
 * demoting any existing primary, and promotes the user USER -> OWNER. `reject`
 * marks the claim REJECTED. Both are recorded in the audit log.
 */
export async function resolveDispute(
  claimId: string,
  action: "grant" | "reject",
  adminEmail: string,
): Promise<ResolveDisputeResult> {
  const claim = await prisma.claimRequest.findUnique({
    where: { id: claimId },
    select: { id: true, businessId: true, userId: true, ownerEmail: true, status: true },
  });
  if (!claim) return { ok: false, reason: "not_found" };

  if (action === "reject") {
    await prisma.$transaction([
      prisma.claimRequest.update({ where: { id: claim.id }, data: { status: "REJECTED" } }),
      prisma.auditLog.create({
        data: {
          action: "CLAIM_REJECTED",
          entityType: "Business",
          entityId: claim.businessId,
          performedBy: adminEmail,
          details: { claimId: claim.id },
        },
      }),
    ]);
    return { ok: true, action: "rejected" };
  }

  // grant: the claim must be tied to a real user to receive ownership.
  if (!claim.userId) return { ok: false, reason: "no_user" };
  const userId = claim.userId;

  await prisma.$transaction([
    // Demote any existing primary owner of this business.
    prisma.businessOwner.updateMany({
      where: { businessId: claim.businessId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.businessOwner.upsert({
      where: { userId_businessId: { userId, businessId: claim.businessId } },
      create: { userId, businessId: claim.businessId, claimId: claim.id, isPrimary: true },
      update: { claimId: claim.id, isPrimary: true },
    }),
    prisma.claimRequest.update({
      where: { id: claim.id },
      data: { status: "VERIFIED", verifiedAt: new Date() },
    }),
    prisma.business.update({
      where: { id: claim.businessId },
      data: { isVerified: true },
    }),
    prisma.user.updateMany({ where: { id: userId, role: "USER" }, data: { role: "OWNER" } }),
    prisma.auditLog.create({
      data: {
        action: "CLAIM_GRANTED",
        entityType: "Business",
        entityId: claim.businessId,
        performedBy: adminEmail,
        details: { claimId: claim.id, userId },
      },
    }),
  ]);

  return { ok: true, action: "granted" };
}
