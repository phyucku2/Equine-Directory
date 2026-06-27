import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { markNotificationsRead } from "@/lib/db/notification";

export const dynamic = "force-dynamic";

// POST /api/notifications/read { ids?: string[] }
// Marks the given notifications read; with no ids, marks ALL unread read.
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: { ids?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      // empty body = mark all
    }
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === "string")
      : undefined;
    const count = await markNotificationsRead(user.id, ids);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
