import { NextResponse } from "next/server";
import { requireBusinessOwner, AuthError } from "@/lib/auth/guards";

// Shared wrapper for owner-guarded API routes. Resolves the route params,
// enforces requireBusinessOwner(id) with the businessId taken ONLY from the URL,
// and maps AuthError -> 401/403 JSON in one place so every owner route handles
// authorization identically.
//
// Usage:
//   export const PATCH = withOwner(async ({ id, user, request }) => { ... });
export function withOwner<P extends { id: string }>(
  handler: (ctx: {
    id: string;
    user: Awaited<ReturnType<typeof requireBusinessOwner>>;
    request: Request;
    params: P;
  }) => Promise<Response>,
) {
  return async (request: Request, { params }: { params: Promise<P> }) => {
    const resolved = await params;
    let user;
    try {
      user = await requireBusinessOwner(resolved.id);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
    return handler({ id: resolved.id, user, request, params: resolved });
  };
}
