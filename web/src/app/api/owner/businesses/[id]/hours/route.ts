import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { replaceHours } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// PUT /api/owner/businesses/[id]/hours — write hoursOfOperation Json. The public
// detail page reads { weekdayDescriptions: string[] } (page.tsx:86), so that is
// the canonical shape we store. Sending null clears the hours.
export const PUT = withOwner(async ({ id, request }) => {
  let body: { weekdayDescriptions?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body === null) {
    await replaceHours(id, null);
    return NextResponse.json({ ok: true, hoursOfOperation: null });
  }

  if (!body || !Array.isArray(body.weekdayDescriptions)) {
    return NextResponse.json(
      { error: "Expected { weekdayDescriptions: string[] } or null." },
      { status: 400 },
    );
  }

  const weekdayDescriptions = body.weekdayDescriptions
    .filter((d): d is string => typeof d === "string")
    .map((d) => d.trim().slice(0, 120))
    .slice(0, 7);

  const result = await replaceHours(id, { weekdayDescriptions });
  return NextResponse.json({ ok: true, hoursOfOperation: result.hoursOfOperation });
});
