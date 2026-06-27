import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/guards";
import { listDisputes, resolveDispute } from "@/lib/db/disputes";

function handleAuth(err: unknown): NextResponse | never {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

// GET /api/admin/disputes — list open claim disputes (admin only).
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return handleAuth(err);
  }
  const disputes = await listDisputes();
  return NextResponse.json({ disputes });
}

// POST /api/admin/disputes — resolve a dispute (grant ownership or reject).
export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    return handleAuth(err);
  }

  let body: { claimId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const claimId = body.claimId?.trim();
  const action = body.action;
  if (!claimId || (action !== "grant" && action !== "reject")) {
    return NextResponse.json(
      { error: "claimId and action ('grant' | 'reject') are required." },
      { status: 400 },
    );
  }

  const result = await resolveDispute(claimId, action, admin.email ?? "admin");
  if (!result.ok) {
    const map: Record<string, { status: number; error: string }> = {
      not_found: { status: 404, error: "Claim not found." },
      no_user: { status: 422, error: "This claim has no associated account to grant ownership to." },
    };
    const r = map[result.reason];
    return NextResponse.json({ error: r.error }, { status: r.status });
  }

  return NextResponse.json({ ok: true, action: result.action });
}
