import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

function makeToken(): string {
  return (randomUUID() + randomUUID()).replace(/-/g, "");
}

const TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72h

function expiryFrom(sentAt: Date): Date {
  return new Date(sentAt.getTime() + TOKEN_TTL_MS);
}

function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface ClaimInput {
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  /** The signed-in user's id (from `auth()`), if any. */
  userId?: string | null;
}

export interface CreateClaimResult {
  claim: { id: string };
  token: string;
  business: { id: string; slug: string; name: string; email: string | null };
  /** Where the verification link is delivered (always `business.email`). */
  deliverTo: string | null;
  tokenExpiresAt: Date;
  /**
   * When the claimant-chosen email does not match the business's crawled
   * contact email (or the business has no email on file), the claim cannot be
   * auto-verified by the email second factor — it is routed to admin review.
   */
  routeToDisputes: boolean;
}

// Create a pending claim with an email-verification token.
//
// SECURITY (§2.4 P0): the verification token is ALWAYS delivered to
// `business.email` — the crawled, business-controlled contact address — and
// NEVER to the claimant-chosen `ownerEmail` (which is attacker-controlled).
// If `ownerEmail` does not match `business.email`, or the business has no email
// on file, the claim is flagged for admin review instead of self-verifying.
export async function createClaim(
  businessId: string,
  input: ClaimInput,
): Promise<CreateClaimResult | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, slug: true, name: true, email: true },
  });
  if (!business) return null;

  const token = makeToken();
  const sentAt = new Date();
  const tokenExpiresAt = expiryFrom(sentAt);

  const claim = await prisma.claimRequest.create({
    data: {
      businessId,
      userId: input.userId ?? null,
      ownerName: input.ownerName,
      ownerEmail: input.ownerEmail,
      ownerPhone: input.ownerPhone || null,
      status: "PENDING",
      verificationMethod: "email",
      verificationToken: token,
      verificationSentAt: sentAt,
      tokenExpiresAt,
    },
    select: { id: true },
  });

  const routeToDisputes = !emailsMatch(input.ownerEmail, business.email);

  return {
    claim,
    token,
    business,
    deliverTo: business.email,
    tokenExpiresAt,
    routeToDisputes,
  };
}

export type VerifyResult =
  | { status: "invalid" }
  | { status: "expired"; claimId: string }
  | { status: "mismatch" } // signed-in email !== business.email
  | { status: "already"; business: { slug: string; name: string } }
  | { status: "disputed"; business: { slug: string; name: string } } // verified but ownership withheld
  | { status: "verified"; business: { slug: string; name: string } };

/**
 * Verify a claim token while signed in (§2.4). The caller MUST pass the
 * authenticated session's user id + Google email — this is the email second
 * factor. The token was sent to `business.email`; the signed-in email must match
 * it (case-insensitive). On success ownership is granted in-transaction and the
 * user is promoted USER -> OWNER (ADMIN is never demoted). If the business
 * already has a primary owner, the claim is recorded VERIFIED but ownership is
 * withheld and the claim is routed to admin disputes.
 */
export async function verifyClaim(
  token: string,
  session: { userId: string; email: string | null | undefined },
): Promise<VerifyResult> {
  const claim = await prisma.claimRequest.findUnique({
    where: { verificationToken: token },
    include: {
      business: {
        select: {
          id: true,
          slug: true,
          name: true,
          email: true,
          verificationBadge: true,
        },
      },
    },
  });
  if (!claim) return { status: "invalid" };

  const business = claim.business;

  if (claim.status === "VERIFIED") {
    return { status: "already", business };
  }

  // Token expiry: tokenExpiresAt (= sentAt + 72h). Fall back to deriving it from
  // verificationSentAt for any pre-stamp claims.
  const expiresAt =
    claim.tokenExpiresAt ??
    (claim.verificationSentAt ? expiryFrom(claim.verificationSentAt) : null);
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return { status: "expired", claimId: claim.id };
  }

  // Email binding (second factor): the signed-in Google email must equal the
  // address the token was sent to — business.email — case-insensitive.
  if (!emailsMatch(session.email, business.email)) {
    return { status: "mismatch" };
  }

  // Non-downgrade badge rule: only upgrade from UNVERIFIED.
  const nextBadge =
    business.verificationBadge === "UNVERIFIED" ? "VERIFIED" : business.verificationBadge;

  // Dispute withholding + grant must be atomic. The "is there already a primary
  // owner?" read and the conditional grant run inside ONE interactive
  // transaction (same form as updateOffering) so two verifications racing on the
  // same currently-unowned business can't both observe `existingPrimary === null`
  // and both upsert isPrimary:true (TOCTOU). The second waits, sees the first's
  // primary owner, and routes to disputes.
  const disputed = await prisma.$transaction(async (tx) => {
    const existingPrimary = await tx.businessOwner.findFirst({
      where: { businessId: business.id, isPrimary: true },
      select: { id: true },
    });

    if (existingPrimary) {
      await tx.claimRequest.update({
        where: { id: claim.id },
        data: { status: "VERIFIED", verifiedAt: new Date(), userId: session.userId },
      });
      await tx.auditLog.create({
        data: {
          action: "CLAIM_DISPUTED",
          entityType: "Business",
          entityId: business.id,
          performedBy: session.email ?? claim.ownerEmail,
          details: { claimId: claim.id, reason: "primary owner already exists" },
        },
      });
      return true;
    }

    await tx.claimRequest.update({
      where: { id: claim.id },
      data: { status: "VERIFIED", verifiedAt: new Date(), userId: session.userId },
    });
    await tx.business.update({
      where: { id: business.id },
      data: { isVerified: true, verificationBadge: nextBadge },
    });
    await tx.businessOwner.upsert({
      where: { userId_businessId: { userId: session.userId, businessId: business.id } },
      create: {
        userId: session.userId,
        businessId: business.id,
        claimId: claim.id,
        isPrimary: true,
      },
      update: { claimId: claim.id, isPrimary: true },
    });
    // Promote USER -> OWNER only; updateMany with a role filter never demotes ADMIN.
    await tx.user.updateMany({
      where: { id: session.userId, role: "USER" },
      data: { role: "OWNER" },
    });
    await tx.auditLog.create({
      data: {
        action: "CLAIM_VERIFIED",
        entityType: "Business",
        entityId: business.id,
        performedBy: session.email ?? claim.ownerEmail,
        details: { claimId: claim.id, userId: session.userId },
      },
    });
    return false;
  });

  return disputed
    ? { status: "disputed", business }
    : { status: "verified", business };
}

/**
 * Issue a fresh token for an existing PENDING claim and re-stamp the 72h expiry.
 * Returns the new token + delivery target so the caller can re-send the email.
 */
export async function resendClaim(
  claimId: string,
  userId: string,
): Promise<
  | { ok: false; reason: "not_found" | "not_owner" | "already_verified" | "no_email" }
  | { ok: true; token: string; tokenExpiresAt: Date; business: { slug: string; name: string; email: string }; verifyUrl: string }
> {
  const claim = await prisma.claimRequest.findUnique({
    where: { id: claimId },
    include: { business: { select: { slug: true, name: true, email: true } } },
  });
  if (!claim) return { ok: false, reason: "not_found" };
  // Only the original claimant may trigger a resend. A claim created without a
  // session (`userId === null`, possible since the claim route stamps userId
  // only when present) has no owner, so NO signed-in user may resend it —
  // otherwise any authenticated user could email-bomb the listing's contact
  // address. A null owner therefore fails this check, same as a mismatch.
  if (!claim.userId || claim.userId !== userId) return { ok: false, reason: "not_owner" };
  if (claim.status === "VERIFIED") return { ok: false, reason: "already_verified" };
  if (!claim.business.email) return { ok: false, reason: "no_email" };

  const token = makeToken();
  const sentAt = new Date();
  const tokenExpiresAt = expiryFrom(sentAt);
  await prisma.claimRequest.update({
    where: { id: claim.id },
    data: { verificationToken: token, verificationSentAt: sentAt, tokenExpiresAt },
  });

  return {
    ok: true,
    token,
    tokenExpiresAt,
    business: { slug: claim.business.slug, name: claim.business.name, email: claim.business.email },
    verifyUrl: `/claim/verify?token=${token}`,
  };
}
