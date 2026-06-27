import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { respondToReview } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// POST /api/owner/businesses/[id]/reviews/[rid]/respond — publish the owner's
// reply to a review and recompute Business.responseRate in the same transaction
// (responseRate = respondedReviewCount / totalReviewCount * 100). The review
// must belong to this business or we 404.
export const POST = withOwner<{ id: string; rid: string }>(async ({ id, request, params }) => {
  let body: { response?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const response = typeof body.response === "string" ? body.response.trim() : "";
  if (!response) {
    return NextResponse.json({ error: "A response is required." }, { status: 400 });
  }
  if (response.length > 5000) {
    return NextResponse.json({ error: "Response is too long." }, { status: 400 });
  }

  const result = await respondToReview(id, params.rid, response.slice(0, 5000));
  if (!result) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, responseRate: result.responseRate });
});
