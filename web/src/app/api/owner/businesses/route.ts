import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { listOwnedBusinesses } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// GET /api/owner/businesses — the dashboard home list. Authorization here is
// "any signed-in user" because the query itself is scoped to businesses the user
// owns (owners: { some: { userId } }); there is no businessId in the URL to
// guard. Returns each owned barn with its response backlog counts.
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const businesses = await listOwnedBusinesses(user.id);
  return NextResponse.json({ businesses });
}
