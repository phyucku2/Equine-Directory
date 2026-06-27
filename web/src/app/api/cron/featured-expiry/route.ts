import { NextResponse, type NextRequest } from "next/server";
import { assertCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";

// featuredUntil expiry cron (§5). Flips `isFeatured = false` for every business
// whose paid featured window has passed, so the existing
// `ORDER BY isFeatured DESC` placement stops boosting expired listings.
//
// Cron-secret guarded via assertCron (Authorization: Bearer ${CRON_SECRET}).
// Idle-safe: with billing off nothing ever sets featuredUntil, so this no-ops.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;

  const now = new Date();
  const { count } = await prisma.business.updateMany({
    where: { isFeatured: true, featuredUntil: { lt: now } },
    data: { isFeatured: false },
  });

  return NextResponse.json({ ok: true, expired: count });
}
