import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createInquiry } from "@/lib/db/inquiry";
import { getEntitlements } from "@/lib/entitlements";
import { sendOwnerInquiryAlert } from "@/lib/email";
import { checkRateLimit } from "@/lib/ratelimit";

// POST /api/businesses/[id]/inquiry — send a lead to a barn (M6 / §3).
// Mirrors the claim route: guests are allowed; when signed in we auto-fill
// missing name/email from the session and stamp `userId` so the lead shows in
// /account/inquiries. Rate-limited by IP via the shared cross-instance limiter
// (these guest-writable POSTs email business.email — a spam/email-bomb vector).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Shared rate limit by IP (cross-instance; §2.6). The middleware does a coarse
  // per-instance first pass — this is the hard, shared backstop.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limit = await checkRateLimit(`inquiry:${ip}`);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: { name?: string; email?: string; phone?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Auto-fill name/email from the signed-in session (guests must supply both).
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const name = (body.name?.trim() || session?.user?.name || "").trim();
  const email = (body.email?.trim() || session?.user?.email || "").trim();
  const phone = body.phone?.trim() || null;
  const message = body.message?.trim() || "";

  if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "A name and a valid email are required." },
      { status: 400 },
    );
  }
  if (!message) {
    return NextResponse.json({ error: "Please include a message." }, { status: 400 });
  }

  const result = await createInquiry(id, { name, email, phone, message, userId });
  if (!result) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  // The lead is always captured (above). Delivery is the paid perk (Zillow
  // model): only barns entitled to receive leads (BASIC+) get the email alert.
  // FREE/unclaimed barns' leads are held and drive the "N inquiries waiting —
  // claim to read" upsell on the listing.
  const canReceiveLeads = getEntitlements({ subscription: result.business.subscription }).canReceiveLeads;
  const delivered = canReceiveLeads && Boolean(result.business.email);
  if (delivered) {
    await sendOwnerInquiryAlert(result.business.email!, {
      businessName: result.business.name,
      fromName: name,
      fromEmail: email,
      fromPhone: phone,
      message,
    });
  }

  await prisma.auditLog.create({
    data: {
      action: "INQUIRY_CREATED",
      entityType: "Business",
      entityId: result.business.id,
      performedBy: userId ? email : `guest:${email}`,
      details: { inquiryId: result.inquiry.id, userId, delivered },
    },
  });

  // The consumer's experience is identical either way — the barn is notified or
  // will see the lead on claim; we never advertise that a barn is unclaimed.
  return NextResponse.json({
    ok: true,
    message: "Your inquiry was sent. The barn will reply to your email.",
  });
}
