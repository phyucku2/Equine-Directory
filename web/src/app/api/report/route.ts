import { NextResponse } from "next/server";
import { createReport, isReportReason, type ReportReason } from "@/lib/db/reports";

export const dynamic = "force-dynamic";

// Read the caller's IP from the standard proxy headers (same source the
// rate-limit middleware uses). Used only to dedupe repeat reports.
function reporterIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}

// POST /api/report — crowdsourced "Not a Stable or Barn" flag (post-launch-fixes
// §4). Body: { businessId, reason?, detail? }. Records the flag; enough
// independent reports auto-hide the listing for admin triage at /admin/reports.
export async function POST(request: Request) {
  let body: { businessId?: string; reason?: string; detail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const businessId = typeof body.businessId === "string" ? body.businessId : "";
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  const reason: ReportReason =
    typeof body.reason === "string" && isReportReason(body.reason) ? body.reason : "not_a_stable";

  const result = await createReport({
    businessId,
    reason,
    detail: typeof body.detail === "string" ? body.detail : null,
    reporterIp: reporterIp(request),
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Don't leak the open count / hidden state to the public client.
  return NextResponse.json({ ok: true });
}
