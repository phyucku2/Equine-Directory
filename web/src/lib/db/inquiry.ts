import { prisma } from "@/lib/prisma";
import type { InquiryStatus, SubTier } from "@prisma/client";

// Consumer inquiries / leads (M6 / §3). Guest leads are allowed (userId is
// nullable); a signed-in user's id is stamped so the inquiry shows in
// /account/inquiries. DB logic lives here, mirroring claim.ts.

export interface InquiryInput {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  /** The signed-in user's id (from `auth()`), if any. Null for guest leads. */
  userId?: string | null;
}

export interface CreateInquiryResult {
  inquiry: { id: string };
  business: {
    id: string;
    slug: string;
    name: string;
    email: string | null;
    // Loaded so the caller can gate lead *delivery* on entitlements
    // (canReceiveLeads is BASIC+). The lead is always stored regardless.
    subscription: { tier: SubTier; status: string; trainerSeats: number } | null;
  };
}

/**
 * Create a lead against a business. Returns null when the business does not
 * exist. The lead is ALWAYS captured (Zillow model); the caller decides whether
 * to deliver it to the owner based on entitlements, emailing `business.email`
 * (if present) via `sendOwnerInquiryAlert` and writing the AuditLog entry.
 */
export async function createInquiry(
  businessId: string,
  input: InquiryInput,
): Promise<CreateInquiryResult | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      slug: true,
      name: true,
      email: true,
      subscription: { select: { tier: true, status: true, trainerSeats: true } },
    },
  });
  if (!business) return null;

  const inquiry = await prisma.inquiry.create({
    data: {
      businessId,
      userId: input.userId ?? null,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      message: input.message,
      status: "NEW",
    },
    select: { id: true },
  });

  return { inquiry, business };
}

export interface UserInquiry {
  id: string;
  message: string;
  status: InquiryStatus;
  createdAt: Date;
  business: { slug: string; name: string };
}

/**
 * Count leads a barn has received — used for the "N inquiries waiting — claim to
 * read" upsell shown on listings whose owner hasn't unlocked lead delivery. Cheap
 * indexed count; safe to call on the public listing page.
 */
export async function countInquiries(businessId: string): Promise<number> {
  return prisma.inquiry.count({ where: { businessId } });
}

/** A signed-in user's sent inquiries, most recent first, for /account/inquiries. */
export async function listUserInquiries(userId: string): Promise<UserInquiry[]> {
  return prisma.inquiry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      message: true,
      status: true,
      createdAt: true,
      business: { select: { slug: true, name: true } },
    },
  });
}
