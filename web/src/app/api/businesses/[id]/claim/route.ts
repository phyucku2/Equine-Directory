import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClaim } from "@/lib/db/claim";
import { sendClaimVerification } from "@/lib/email";
import { absoluteUrl } from "@/lib/urls";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { ownerName?: string; ownerEmail?: string; ownerPhone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ownerName = body.ownerName?.trim();
  const ownerEmail = body.ownerEmail?.trim();
  if (!ownerName || !ownerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
    return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
  }

  // Stamp the signed-in user (if any) so verification can grant them ownership.
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const result = await createClaim(id, {
    ownerName,
    ownerEmail,
    ownerPhone: body.ownerPhone,
    userId,
  });
  if (!result) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  const verifyUrl = absoluteUrl(`/claim/verify?token=${result.token}`);

  // SECURITY (§2.4): the link is emailed to business.email, NOT the claimant.
  // No business email on file, or claimant email != business email -> route to
  // admin disputes (the claim cannot self-verify via the email second factor).
  if (result.routeToDisputes || !result.deliverTo) {
    return NextResponse.json({
      ok: true,
      status: "pending_review",
      message:
        "Your claim was received and is pending admin review (we couldn't auto-verify it against the listing's contact email).",
    });
  }

  const { url } = await sendClaimVerification(result.deliverTo, verifyUrl, result.business.name);

  return NextResponse.json({
    ok: true,
    status: "sent",
    message: `A verification link was sent to the listing's contact email.`,
    // Raw verify URL is only returned in non-production (for tests/local dev);
    // sendClaimVerification returns it then, and the real address otherwise.
    ...(process.env.NODE_ENV !== "production" ? { verifyUrl: url } : {}),
  });
}
