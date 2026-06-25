import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

function makeToken(): string {
  return (randomUUID() + randomUUID()).replace(/-/g, "");
}

export interface ClaimInput {
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
}

// Create a pending claim with an email-verification token. (Email delivery is a
// later task; until then the verify link is returned to the caller.)
export async function createClaim(businessId: string, input: ClaimInput) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, slug: true, name: true },
  });
  if (!business) return null;

  const token = makeToken();
  const claim = await prisma.claimRequest.create({
    data: {
      businessId,
      ownerName: input.ownerName,
      ownerEmail: input.ownerEmail,
      ownerPhone: input.ownerPhone || null,
      status: "PENDING",
      verificationMethod: "email",
      verificationToken: token,
      verificationSentAt: new Date(),
    },
  });
  return { claim, token, business };
}

// Verify a claim token: mark the claim VERIFIED and badge the business.
export async function verifyClaim(token: string) {
  const claim = await prisma.claimRequest.findUnique({
    where: { verificationToken: token },
    include: { business: { select: { slug: true, name: true, verificationBadge: true } } },
  });
  if (!claim) return { status: "invalid" as const };
  if (claim.status === "VERIFIED") {
    return { status: "already" as const, business: claim.business };
  }

  // Only upgrade from UNVERIFIED; never downgrade TRUSTED/PREMIUM.
  const nextBadge =
    claim.business.verificationBadge === "UNVERIFIED"
      ? "VERIFIED"
      : claim.business.verificationBadge;

  await prisma.$transaction([
    prisma.claimRequest.update({
      where: { id: claim.id },
      data: { status: "VERIFIED", verifiedAt: new Date() },
    }),
    prisma.business.update({
      where: { id: claim.businessId },
      data: { isVerified: true, verificationBadge: nextBadge },
    }),
    prisma.auditLog.create({
      data: {
        action: "CLAIM_VERIFIED",
        entityType: "Business",
        entityId: claim.businessId,
        performedBy: claim.ownerEmail,
        details: { claimId: claim.id },
      },
    }),
  ]);

  return { status: "verified" as const, business: claim.business };
}
