import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { withOwner } from "@/lib/auth/owner-route";
import { getEntitlements } from "@/lib/entitlements";
import {
  createOwnerImage,
  countOwnerPhotos,
  deleteOwnerImage,
  reorderOwnerImages,
  loadBusinessForEntitlements,
} from "@/lib/db/owner";

export const dynamic = "force-dynamic";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// Resolve the owner-photo entitlement (maxImages, from getEntitlements) + the
// remaining quota for a business. The logo is excluded from the count/quota.
async function photoGate(businessId: string) {
  const [business, used] = await Promise.all([
    loadBusinessForEntitlements(businessId),
    countOwnerPhotos(businessId),
  ]);
  const max = business ? getEntitlements(business).maxImages : 0;
  return { max, used, remaining: max - used };
}

// POST /api/owner/businesses/[id]/images
//
// Two responsibilities on one route, distinguished by the body shape:
//  1. Blob client-upload token issuance + completion callback. The browser's
//     `upload()` helper hits this with a HandleUploadBody; we gate token issuance
//     behind getEntitlements(business).maxImages and enforce MIME + size in the
//     presigned token (allowedContentTypes / maximumSizeInBytes). On
//     `onUploadCompleted` (prod webhook) we insert the BusinessImage row.
//  2. Direct JSON insert `{ url, width?, height?, altText?, caption? }` — used by
//     the client right after upload (and the only insert path on localhost, where
//     the Vercel completion webhook can't reach us). The insert is gated again
//     behind the maxImages quota.
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
          // Gate token issuance behind the owner-photo entitlement + quota.
          const { max, remaining } = await photoGate(id);
          if (max <= 0) {
            throw new Error("Photo uploads are not included in this plan.");
          }
          if (remaining <= 0) {
            throw new Error("Photo limit reached for this plan.");
          }
          return {
            allowedContentTypes: ALLOWED_CONTENT_TYPES,
            maximumSizeInBytes: MAX_BYTES,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ businessId: id }),
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          // Production-only webhook: persist the uploaded blob as an OWNER image.
          let businessId = id;
          try {
            if (tokenPayload) businessId = JSON.parse(tokenPayload).businessId ?? id;
          } catch {
            /* keep id */
          }
          const { max, remaining } = await photoGate(businessId);
          if (max <= 0 || remaining <= 0) return;
          await createOwnerImage(businessId, { url: blob.url });
        },
      });
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // ---- Phase 2: direct DB insert after a completed client upload ----
  const { url, width, height, altText, caption } = body as {
    url?: unknown;
    width?: unknown;
    height?: unknown;
    altText?: unknown;
    caption?: unknown;
  };
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid uploaded image url is required." }, { status: 400 });
  }

  const { max, remaining } = await photoGate(id);
  if (max <= 0) {
    return NextResponse.json(
      { error: "Photo uploads are not included in this plan.", upgradeRequired: true },
      { status: 403 },
    );
  }
  if (remaining <= 0) {
    return NextResponse.json(
      { error: "Photo limit reached for this plan.", upgradeRequired: true },
      { status: 403 },
    );
  }

  const image = await createOwnerImage(id, {
    url,
    width: typeof width === "number" ? width : null,
    height: typeof height === "number" ? height : null,
    altText: typeof altText === "string" ? altText.slice(0, 255) : null,
    caption: typeof caption === "string" ? caption.slice(0, 512) : null,
  });
  return NextResponse.json({ ok: true, image });
});

// DELETE /api/owner/businesses/[id]/images?imageId=... — remove an OWNER image
// (and its blob). Crawled/Google rows are never deletable here.
export const DELETE = withOwner(async ({ id, request }) => {
  const url = new URL(request.url);
  const imageId = url.searchParams.get("imageId");
  if (!imageId) {
    return NextResponse.json({ error: "imageId is required." }, { status: 400 });
  }
  const removed = await deleteOwnerImage(id, imageId);
  if (!removed) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
  // Best-effort blob cleanup (only our own blob host; ignore failures).
  if (process.env.BLOB_READ_WRITE_TOKEN && removed.url.includes(".blob.vercel-storage.com")) {
    try {
      await del(removed.url);
    } catch {
      /* leave the orphaned blob rather than fail the request */
    }
  }
  return NextResponse.json({ ok: true });
});

// PATCH /api/owner/businesses/[id]/images — reorder OWNER images.
// Body: { order: string[] } (image ids, top-to-bottom). The first becomes cover.
export const PATCH = withOwner(async ({ id, request }) => {
  let body: { order?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!Array.isArray(body.order) || !body.order.every((x) => typeof x === "string")) {
    return NextResponse.json({ error: "order must be an array of image ids." }, { status: 400 });
  }
  const count = await reorderOwnerImages(id, body.order as string[]);
  return NextResponse.json({ ok: true, reordered: count });
});
