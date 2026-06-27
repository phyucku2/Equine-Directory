import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { verifyClaim } from "@/lib/db/claim";

// POST /api/claim/verify — confirm a claim token while signed in.
//
// Verification is a POST (never a GET side effect): GET prefetch/CSRF must not
// mutate state. The route requires a session; the client confirm form sends the
// token only after the user explicitly confirms. The email second factor is
// applied inside verifyClaim (signed-in Google email === business.email).
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: "auth_required" }, { status: err.status });
    }
    throw err;
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const result = await verifyClaim(token, { userId: user.id, email: user.email });

  switch (result.status) {
    case "invalid":
      return NextResponse.json(
        { status: "invalid", error: "This verification link isn't valid." },
        { status: 400 },
      );
    case "expired":
      return NextResponse.json(
        { status: "expired", claimId: result.claimId, error: "This link has expired." },
        { status: 410 },
      );
    case "mismatch":
      return NextResponse.json(
        {
          status: "mismatch",
          error:
            "The email on your account doesn't match the listing's contact email. Sign in with the mailbox the link was sent to.",
        },
        { status: 403 },
      );
    case "already":
      return NextResponse.json({ status: "already", business: result.business });
    case "disputed":
      return NextResponse.json({ status: "disputed", business: result.business });
    case "verified":
      return NextResponse.json({ status: "verified", business: result.business });
  }
}
