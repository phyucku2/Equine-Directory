import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { editReview, deleteReview, type MutateReviewResult } from "@/lib/db/review";

export const dynamic = "force-dynamic";

function mapResult(result: MutateReviewResult): NextResponse {
  if (result.ok) return NextResponse.json({ ok: true });
  if (result.reason === "not_found") {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  return NextResponse.json({ error: "You can only edit your own reviews." }, { status: 403 });
}

// PATCH /api/reviews/[id] — edit your own review (M7 / §3). Author-only. Edits
// reset moderation (isApproved -> false) and recompute the business rating in a
// $transaction (see lib/db/review.ts).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    let body: { rating?: unknown; title?: unknown; content?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const input: { rating?: number; title?: string | null; content?: string } = {};

    if (body.rating !== undefined) {
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json({ error: "A rating from 1 to 5 is required." }, { status: 400 });
      }
      input.rating = rating;
    }

    if (body.content !== undefined) {
      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (!content) {
        return NextResponse.json({ error: "Please write a review." }, { status: 400 });
      }
      if (content.length > 5000) {
        return NextResponse.json({ error: "Your review is too long." }, { status: 400 });
      }
      input.content = content;
    }

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 255) : "";
      input.title = title || null;
    }

    const result = await editReview(id, user.id, input);
    return mapResult(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// DELETE /api/reviews/[id] — delete your own review (M7 / §3). Author-only.
// Recomputes the business rating in a $transaction.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await deleteReview(id, user.id);
    return mapResult(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
