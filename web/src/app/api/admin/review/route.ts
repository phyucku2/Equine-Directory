import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/admin";
import { moderateAssignment, bulkRejectByName, moderationQueueCount } from "@/lib/db/moderation";
import { businessUrl } from "@/lib/urls";

// Admin moderation actions, moved off Server Actions onto a plain JSON endpoint.
// Server Actions embed a per-deployment action id in the page; after a redeploy
// the already-loaded /admin/review page holds stale ids, so Approve/Reject
// silently no-op (the reported bug). A fetch to this route can't go stale, and
// the client gets an explicit ok/err back so the UI can show the item resolve.
//
// PURGE keywords for the "remove church/equipment" sweep (owner request
// 2026-07-17): these are places of worship and equipment dealers that picked up
// a stray horse-boarding claim during the crawl. Bulk-reject only unconfirmed
// grade 1/2 claims — never a verified barn.
const PURGE_KEYWORDS = ["church", "equipment"];

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    op?: string;
    businessId?: string;
    categoryId?: string;
    decision?: "approve" | "reject";
    slug?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.op === "moderate") {
    const { businessId, categoryId, decision, slug } = body;
    if (!businessId || !categoryId || (decision !== "approve" && decision !== "reject")) {
      return NextResponse.json({ error: "Missing businessId/categoryId/decision" }, { status: 400 });
    }
    const res = await moderateAssignment(businessId, categoryId, decision, "admin");
    if (!res) {
      return NextResponse.json({ error: "Assignment not found (already resolved?)" }, { status: 404 });
    }
    if (slug) revalidatePath(businessUrl(slug));
    revalidatePath("/admin/review");
    const pending = await moderationQueueCount();
    return NextResponse.json({ ok: true, pending });
  }

  if (body.op === "purge") {
    const result = await bulkRejectByName(PURGE_KEYWORDS, "admin");
    revalidatePath("/admin/review");
    const pending = await moderationQueueCount();
    return NextResponse.json({ ok: true, ...result, keywords: PURGE_KEYWORDS, pending });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
