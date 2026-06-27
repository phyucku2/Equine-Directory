import { prisma } from "@/lib/prisma";
import type { InquiryStatus } from "@prisma/client";

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
  business: { id: string; slug: string; name: string; email: string | null };
}

/**
 * Create a lead against a business. Returns null when the business does not
 * exist. The caller is responsible for emailing `business.email` (if present)
 * via `sendOwnerInquiryAlert` and writing the AuditLog entry.
 */
export async function createInquiry(
  businessId: string,
  input: InquiryInput,
): Promise<CreateInquiryResult | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, slug: true, name: true, email: true },
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
