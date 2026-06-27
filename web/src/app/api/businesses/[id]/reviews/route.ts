import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { createReview } from "@/lib/db/review";
import { checkRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// POST /api/businesses/[id]/reviews — post a review (M7 / §3). Login required.
// The signed-in, email-verified author is stamped as `isVerifiedAuthor: true`,
// which auto-approves the review so it's immediately visible; Business.rating /
// reviewCount are recomputed atomically in a $transaction (see lib/db/review.ts).
// Rate-limited by IP via the shared cross-instance limiter (write spam vector).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Shared rate limit by IP (cross-instance; §2.6). The middleware does a coarse
  // per-instance first pass — this is the hard, shared backstop.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limit = await checkRateLimit(`reviews:${ip}`);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let body: { rating?: unknown; title?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "A rating from 1 to 5 is required." }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Please write a review." }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: "Your review is too long." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 255) : "";

  const result = await createReview(id, {
    userId: user.id,
    authorName: user.name ?? "Anonymous",
    authorEmail: user.email ?? null,
    rating,
    title: title || null,
    content: content.slice(0, 5000),
    // Signed-in user from an OAuth provider -> treat as a verified author and
    // auto-approve so the review is immediately visible.
    isVerifiedAuthor: true,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "You've already reviewed this stable. You can edit your review instead." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    approved: result.review.isApproved,
    message: "Thanks! Your review is now live.",
  });
}
