import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { withOwner } from "@/lib/auth/owner-route";
import { requireEntitlement } from "@/lib/auth/owner-entitlement";
import { setLogo, deleteLogo } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"];
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

// POST /api/owner/businesses/[id]/logo
//
// Mirrors the images route's two-phase shape (Vercel blob client-upload token +
// direct DB insert), but for the single logo (BusinessImage isLogo:true). Gated
// behind getEntitlements(business).canLogo. The logo does NOT count against the
// owner-image quota. Uploading a new logo replaces (and best-effort deletes) the
// previous one.
async function bestEffortDelete(urls: string[]) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  for (const url of urls) {
    if (!url.includes(".blob.vercel-storage.com")) continue;
    try {
      await del(url);
    } catch {
      /* leave the orphaned blob rather than fail the request */
    }
  }
}

export const POST = withOwner(async ({ id, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const isBlobCallback =
    !!body &&
    typeof body === "object" &&
    typeof (body as { type?: unknown }).type === "string";

  // ---- Phase 1: blob client-upload token handler ----
  if (isBlobCallback) {
    try {
      const result = await handleUpload({
        request,
        body: body as HandleUploadBody,
        onBeforeGenerateToken: async () => {
          const gate = await requireEntitlement(id, (e) => e.canLogo, "Logo upload requires the Verified plan.");
          if (gate.blocked) throw new Error("A logo isn't included in this plan.");
          return {
            allowedContentTypes: ALLOWED_CONTENT_TYPES,
            maximumSizeInBytes: MAX_BYTES,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ businessId: id }),
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          let businessId = id;
          try {
            if (tokenPayload) businessId = JSON.parse(tokenPayload).businessId ?? id;
          } catch {
            /* keep id */
          }
          const { previousUrls } = await setLogo(businessId, blob.url);
          await bestEffortDelete(previousUrls);
        },
      });
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // ---- Phase 2: direct DB insert after a completed client upload ----
  const gate = await requireEntitlement(id, (e) => e.canLogo, "Logo upload requires the Verified plan.");
  if (gate.blocked) return gate.response;

  const { url } = body as { url?: unknown };
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid uploaded logo url is required." }, { status: 400 });
  }

  const { image, previousUrls } = await setLogo(id, url);
  await bestEffortDelete(previousUrls);
  return NextResponse.json({ ok: true, image });
});

// DELETE /api/owner/businesses/[id]/logo — remove the logo (and its blob).
export const DELETE = withOwner(async ({ id }) => {
  const removed = await deleteLogo(id);
  if (!removed) {
    return NextResponse.json({ error: "No logo to remove." }, { status: 404 });
  }
  await bestEffortDelete([removed.url]);
  return NextResponse.json({ ok: true });
});
