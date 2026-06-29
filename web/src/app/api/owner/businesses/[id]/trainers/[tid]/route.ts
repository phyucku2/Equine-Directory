import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { withOwner } from "@/lib/auth/owner-route";
import { requireEntitlement } from "@/lib/auth/owner-entitlement";
import { updateTrainer, deleteTrainer } from "@/lib/db/owner";
import { parseTrainer } from "../_validate";

export const dynamic = "force-dynamic";

// PATCH /api/owner/businesses/[id]/trainers/[tid] — edit a trainer profile. Still
// requires the TEAM tier (maxTrainers > 0) but not a free seat (editing an
// existing one never exceeds the cap).
export const PATCH = withOwner<{ id: string; tid: string }>(async ({ id, request, params }) => {
  const gate = await requireEntitlement(id, (e) => e.maxTrainers > 0, "Trainer profiles require the Team plan.");
  if (gate.blocked) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = parseTrainer(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const trainer = await updateTrainer(id, params.tid, parsed.data);
  if (!trainer) return NextResponse.json({ error: "Trainer not found." }, { status: 404 });
  return NextResponse.json({ ok: true, trainer });
});

// DELETE /api/owner/businesses/[id]/trainers/[tid] — remove a trainer (frees a seat).
export const DELETE = withOwner<{ id: string; tid: string }>(async ({ id, params }) => {
  const removed = await deleteTrainer(id, params.tid);
  if (!removed) return NextResponse.json({ error: "Trainer not found." }, { status: 404 });
  if (
    removed.photoUrl &&
    process.env.BLOB_READ_WRITE_TOKEN &&
    removed.photoUrl.includes(".blob.vercel-storage.com")
  ) {
    try {
      await del(removed.photoUrl);
    } catch {
      /* leave the orphaned blob rather than fail the request */
    }
  }
  return NextResponse.json({ ok: true });
});
