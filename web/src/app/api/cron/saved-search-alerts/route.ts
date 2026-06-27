import { NextResponse, type NextRequest } from "next/server";
import { assertCron } from "@/lib/cron-auth";
import { runSavedSearchAlerts } from "@/lib/alerts/runSavedSearchAlerts";

// GET /api/cron/saved-search-alerts — runs the saved-search alert engine.
// Cron-secret guarded (§2.6): 401 without `Authorization: Bearer ${CRON_SECRET}`.
// Wire via Vercel cron config (e.g. daily).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;

  const result = await runSavedSearchAlerts();
  return NextResponse.json({ ok: true, ...result });
}
