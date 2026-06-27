import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { createSavedSearch, listSavedSearches } from "@/lib/db/savedSearch";
import type { AlertFrequency } from "@prisma/client";

// Saved searches (M8a / §3). Login required (no guest path).
export const dynamic = "force-dynamic";

const FREQUENCIES: AlertFrequency[] = ["INSTANT", "DAILY", "WEEKLY"];

function parseFrequency(v: unknown): AlertFrequency | undefined {
  return typeof v === "string" && (FREQUENCIES as string[]).includes(v)
    ? (v as AlertFrequency)
    : undefined;
}

// GET /api/saved-searches — the current user's saved searches.
export async function GET() {
  try {
    const user = await requireUser();
    const searches = await listSavedSearches(user.id);
    return NextResponse.json({ searches });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// POST /api/saved-searches { name?, filters, frequency?, emailEnabled? }
// Idempotent per (user, normalized filters): re-saving updates the name/freq.
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: {
      name?: string | null;
      filters?: unknown;
      frequency?: unknown;
      emailEnabled?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    if (body.filters == null || typeof body.filters !== "object") {
      return NextResponse.json({ error: "filters is required." }, { status: 400 });
    }
    const result = await createSavedSearch(user.id, {
      name: typeof body.name === "string" ? body.name : null,
      filters: body.filters,
      frequency: parseFrequency(body.frequency),
      emailEnabled: typeof body.emailEnabled === "boolean" ? body.emailEnabled : undefined,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: `You can save at most ${result.limit} searches. Delete one first.` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: true, search: result.search, created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
