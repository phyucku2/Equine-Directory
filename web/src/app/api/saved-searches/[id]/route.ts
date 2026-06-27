import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { deleteSavedSearch, updateSavedSearch } from "@/lib/db/savedSearch";
import type { AlertFrequency } from "@prisma/client";

export const dynamic = "force-dynamic";

const FREQUENCIES: AlertFrequency[] = ["INSTANT", "DAILY", "WEEKLY"];

function parseFrequency(v: unknown): AlertFrequency | undefined {
  return typeof v === "string" && (FREQUENCIES as string[]).includes(v)
    ? (v as AlertFrequency)
    : undefined;
}

// PATCH /api/saved-searches/[id] { name?, frequency?, emailEnabled? }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireUser();
    let body: { name?: string | null; frequency?: unknown; emailEnabled?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const updated = await updateSavedSearch(user.id, id, {
      ...(body.name !== undefined ? { name: typeof body.name === "string" ? body.name : null } : {}),
      ...(body.frequency !== undefined ? { frequency: parseFrequency(body.frequency) } : {}),
      ...(typeof body.emailEnabled === "boolean" ? { emailEnabled: body.emailEnabled } : {}),
    });
    if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, search: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// DELETE /api/saved-searches/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireUser();
    const removed = await deleteSavedSearch(user.id, id);
    if (!removed) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, removed: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
