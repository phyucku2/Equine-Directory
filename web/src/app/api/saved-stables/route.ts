import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { saveStable, listSavedStableIds } from "@/lib/db/savedStable";

// Consumer favorites (M5 / §3). Login required (no guest path).
export const dynamic = "force-dynamic";

// GET /api/saved-stables — the current user's saved business ids. Consumed by
// the client-side heart merge on cards + the business page.
export async function GET() {
  try {
    const user = await requireUser();
    const ids = await listSavedStableIds(user.id);
    return NextResponse.json({ ids });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// POST /api/saved-stables { businessId } — save a stable. Idempotent.
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: { businessId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const businessId = body.businessId?.trim();
    if (!businessId) {
      return NextResponse.json({ error: "businessId is required." }, { status: 400 });
    }
    const result = await saveStable(user.id, businessId);
    if (!result) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    return NextResponse.json({ ok: true, saved: true, created: result.created });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
