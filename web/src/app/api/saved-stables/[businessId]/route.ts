import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { unsaveStable } from "@/lib/db/savedStable";

export const dynamic = "force-dynamic";

// DELETE /api/saved-stables/[businessId] — remove a saved stable. Idempotent.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  try {
    const user = await requireUser();
    const { removed } = await unsaveStable(user.id, businessId);
    return NextResponse.json({ ok: true, saved: false, removed });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
