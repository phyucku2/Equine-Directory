import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { setInquiryStatus } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "READ", "REPLIED", "ARCHIVED"] as const;
type Status = (typeof STATUSES)[number];

// PATCH /api/owner/businesses/[id]/inquiries/[iid] — flip an inquiry's status
// (mark read / replied / archived) from the inbox tab. Owner-guarded; the
// inquiry must belong to this business or we 404.
export const PATCH = withOwner<{ id: string; iid: string }>(async ({ id, request, params }) => {
  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof body.status !== "string" || !(STATUSES as readonly string[]).includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${STATUSES.join(", ")}` },
      { status: 400 },
    );
  }
  const result = await setInquiryStatus(id, params.iid, body.status as Status);
  if (!result) {
    return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, inquiry: result });
});
