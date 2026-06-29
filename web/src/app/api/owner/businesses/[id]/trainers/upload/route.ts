import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { withOwner } from "@/lib/auth/owner-route";
import { requireEntitlement } from "@/lib/auth/owner-entitlement";

export const dynamic = "force-dynamic";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

// POST /api/owner/businesses/[id]/trainers/upload — Vercel blob client-upload
// token handler for a trainer's single photo. Unlike the images route this does
// NOT create any DB row; the client takes the returned blob url and submits it in
// the trainer create/update body (Trainer.photoUrl). Gated behind the TEAM tier.
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
        const gate = await requireEntitlement(id, (e) => e.maxTrainers > 0, "Trainer profiles require the Team plan.");
        if (gate.blocked) throw new Error("Trainer profiles aren't included in this plan.");
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        /* no DB row — the url is stored on the Trainer via create/update */
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
