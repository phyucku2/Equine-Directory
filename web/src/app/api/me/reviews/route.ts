import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { listReviewsForUser } from "@/lib/db/review";

export const dynamic = "force-dynamic";

// GET /api/me/reviews — the signed-in user's own reviews (M7 / §3).
export async function GET() {
  try {
    const user = await requireUser();
    const reviews = await listReviewsForUser(user.id);
    return NextResponse.json({ reviews });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
