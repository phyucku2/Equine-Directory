import { NextResponse, type NextRequest } from "next/server";

// Cron auth: every cron route (saved-search-alerts, featured-expiry) must verify
// `Authorization: Bearer ${CRON_SECRET}`. Defined once and reused. Wire the
// secret via Vercel cron config.

/**
 * Returns a 401 NextResponse if the request is not an authorized cron call,
 * otherwise null. Usage:
 *   const denied = assertCron(req);
 *   if (denied) return denied;
 */
export function assertCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 401 });
  }
  const header = req.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
