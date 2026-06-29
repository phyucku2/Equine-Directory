import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { withOwner } from "@/lib/auth/owner-route";
import { requireEntitlement } from "@/lib/auth/owner-entitlement";

export const dynamic = "force-dynamic";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

// POST /api/owner/businesses/[id]/events/upload — Vercel blob client-upload token
// handler for an event's image. No DB row is created; the client submits the
// returned blob url in the event create/update body (Event.imageUrl). Gated
// behind the EVENTS tier (canEvents).
export const POST = withOwner(async ({ id, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      request,
      body: body as HandleUploadBody,
      onBeforeGenerateToken: async () => {
        const gate = await requireEntitlement(id, (e) => e.canEvents, "Publishing events requires the Events plan.");
        if (gate.blocked) throw new Error("Events aren't included in this plan.");
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        /* no DB row — the url is stored on the Event via create/update */
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
