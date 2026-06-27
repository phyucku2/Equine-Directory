import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { resendClaim } from "@/lib/db/claim";
import { sendClaimVerification } from "@/lib/email";
import { absoluteUrl } from "@/lib/urls";
import { checkRateLimit } from "@/lib/ratelimit";

// POST /api/claim/resend — re-issue a fresh 72h token for a PENDING claim and
// re-send the verification link to the listing's contact email. Session
// required; only the original claimant may trigger a resend.
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  // Shared rate limit by IP (cross-instance; §2.6). This route re-mails the
  // listing's contact address, so it's an email-bomb vector like /inquiry and
  // /reviews — guard it the same way.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limit = await checkRateLimit(`claim-resend:${ip}`);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: { claimId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const claimId = body.claimId?.trim();
  if (!claimId) {
    return NextResponse.json({ error: "Missing claimId." }, { status: 400 });
  }

  const result = await resendClaim(claimId, user.id);
  if (!result.ok) {
    const map: Record<string, { status: number; error: string }> = {
      not_found: { status: 404, error: "Claim not found." },
      not_owner: { status: 403, error: "You can't resend this claim." },
      already_verified: { status: 409, error: "This claim is already verified." },
      no_email: { status: 422, error: "This listing has no contact email on file." },
    };
    const r = map[result.reason];
    return NextResponse.json({ error: r.error }, { status: r.status });
  }

  const verifyUrl = absoluteUrl(result.verifyUrl);
  const { url } = await sendClaimVerification(result.business.email, verifyUrl, result.business.name);

  return NextResponse.json({
    ok: true,
    message: "A fresh verification link was sent to the listing's contact email.",
    ...(process.env.NODE_ENV !== "production" ? { verifyUrl: url } : {}),
  });
}
