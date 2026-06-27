import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { countUnread, listNotifications } from "@/lib/db/notification";

// In-app notifications (M8b / §3). Login required.
export const dynamic = "force-dynamic";

// GET /api/notifications — the current user's notifications + unread count.
// Used by the bell badge and /account/notifications.
export async function GET() {
  try {
    const user = await requireUser();
    const [notifications, unread] = await Promise.all([
      listNotifications(user.id),
      countUnread(user.id),
    ]);
    return NextResponse.json({ notifications, unread });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
