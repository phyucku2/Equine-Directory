import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

// Consumer reviews (M7 / §3). DB logic lives here, mirroring claim.ts / inquiry.ts.
//
// RATING RECOMPUTE INVARIANT (§3): Business.rating + reviewCount are derived from
// the set of *approved* reviews and MUST be recomputed in the same $transaction
// as every review create / edit / delete — otherwise the aggregate drifts.
//
// Moderation policy (§3): reviews authored by a signed-in, email-verified user
// (`isVerifiedAuthor === true`) auto-approve and are immediately visible. Guest
// or *edited* reviews go back to pending (`isApproved: false`).

// A transaction-scoped client (the `tx` handed to $transaction callbacks).
type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Recompute Business.rating (avg of approved review ratings, 2dp) and
 * reviewCount (count of approved reviews) from the current rows. MUST be called
 * inside the same transaction as the mutating write so the aggregate is atomic.
 */
async function recomputeBusinessRating(tx: Tx, businessId: string): Promise<void> {
  const agg = await tx.review.aggregate({
    where: { businessId, isApproved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const count = agg._count._all;
  const avg = agg._avg.rating;
  await tx.business.update({
    where: { id: businessId },
    data: {
      reviewCount: count,
      // Decimal(3,2) column — round the average to 2dp; null when no approved reviews.
      rating: avg != null ? Math.round(avg * 100) / 100 : null,
    },
  });
}

export interface CreateReviewInput {
  userId: string;
  authorName: string;
  authorEmail: string | null;
  rating: number;
  title?: string | null;
  content: string;
  /** Signed-in, email-verified author -> auto-approve + immediately visible. */
  isVerifiedAuthor: boolean;
}

export type CreateReviewResult =
  | { ok: false; reason: "not_found" | "duplicate" }
  | { ok: true; review: { id: string; isApproved: boolean } };

/**
 * Create a review for a business and recompute the business rating in one
 * transaction. One review per (user, business): a second attempt returns
 * `duplicate` (use editReview to change it).
 */
export async function createReview(
  businessId: string,
  input: CreateReviewInput,
): Promise<CreateReviewResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) return { ok: false, reason: "not_found" };

  const existing = await prisma.review.findFirst({
    where: { businessId, userId: input.userId },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "duplicate" };

  const isApproved = input.isVerifiedAuthor;

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        businessId,
        userId: input.userId,
        authorName: input.authorName,
        authorEmail: input.authorEmail,
        rating: input.rating,
        title: input.title ?? null,
        content: input.content,
        isVerifiedAuthor: input.isVerifiedAuthor,
        isApproved,
      },
      select: { id: true, isApproved: true },
    });
    await recomputeBusinessRating(tx, businessId);
    return created;
  });

  return { ok: true, review };
}

export interface ReviewSummary {
  id: string;
  businessId: string;
  rating: number;
  title: string | null;
  content: string;
  isApproved: boolean;
  ownerResponse: string | null;
  ownerRespondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  business: { slug: string; name: string };
}

/** The signed-in user's own reviews, newest first (for /account/reviews). */
export async function listReviewsForUser(userId: string): Promise<ReviewSummary[]> {
  const rows = await prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      businessId: true,
      rating: true,
      title: true,
      content: true,
      isApproved: true,
      ownerResponse: true,
      ownerRespondedAt: true,
      createdAt: true,
      updatedAt: true,
      business: { select: { slug: true, name: true } },
    },
  });
  return rows;
}

export interface EditReviewInput {
  rating?: number;
  title?: string | null;
  content?: string;
}

export type MutateReviewResult =
  | { ok: false; reason: "not_found" | "forbidden" }
  | { ok: true };

/**
 * Edit a review the user authored. Edits RESET moderation (`isApproved: false`)
 * and recompute the business rating in the same transaction (a previously
 * approved review leaving the approved set must drop out of the aggregate).
 * Author-only: returns `forbidden` if `userId` is not the review's author.
 */
export async function editReview(
  reviewId: string,
  userId: string,
  input: EditReviewInput,
): Promise<MutateReviewResult> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, userId: true, businessId: true },
  });
  if (!review) return { ok: false, reason: "not_found" };
  if (review.userId !== userId) return { ok: false, reason: "forbidden" };

  const data: Prisma.ReviewUpdateInput = { isApproved: false };
  if (input.rating != null) data.rating = input.rating;
  if (input.title !== undefined) data.title = input.title;
  if (input.content != null) data.content = input.content;

  await prisma.$transaction(async (tx) => {
    await tx.review.update({ where: { id: review.id }, data });
    await recomputeBusinessRating(tx, review.businessId);
  });

  return { ok: true };
}

/**
 * Delete a review the user authored and recompute the business rating in the
 * same transaction. Author-only.
 */
export async function deleteReview(
  reviewId: string,
  userId: string,
): Promise<MutateReviewResult> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, userId: true, businessId: true },
  });
  if (!review) return { ok: false, reason: "not_found" };
  if (review.userId !== userId) return { ok: false, reason: "forbidden" };

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: review.id } });
    await recomputeBusinessRating(tx, review.businessId);
  });

  return { ok: true };
}
