import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

// POST /api/revalidate — called by the crawler after a batch upsert.
// Secret-guarded via x-revalidate-secret header.
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tag?: string; path?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.tag) revalidateTag(body.tag, { expire: 0 });
  if (body.path) revalidatePath(body.path);
  // Always refresh the high-traffic surfaces touched by new listings.
  revalidatePath("/");
  revalidatePath("/search");

  return NextResponse.json({ revalidated: true, tag: body.tag ?? null, path: body.path ?? null });
}
