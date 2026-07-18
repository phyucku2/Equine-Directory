import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createInquiry } from "@/lib/db/inquiry";
import { getEntitlements } from "@/lib/entitlements";
import { sendOwnerInquiryAlert, sendClaimInviteForInquiry, sendOperatorInquiryAlert } from "@/lib/email";
import { checkRateLimit } from "@/lib/ratelimit";
import { absoluteUrl } from "@/lib/urls";

// Don't re-email an unclaimed barn about waiting inquiries more than once per
// this window — a barn that gets several leads should get one nudge, not a burst.
const CLAIM_INVITE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// Operator alerts go here so you can personally text the barn to claim. Defaults
// to the first ADMIN_EMAILS entry when OPS_ALERT_EMAIL isn't set.
const OPS_ALERT_EMAIL =
  process.env.OPS_ALERT_EMAIL ??
  (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() ??
  "";

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

  // Held lead on an UNCLAIMED barn that published an email: invite them to claim
  // and read it (owner decision 2026-07-16). Deduped via a recent CLAIM_INVITE
  // audit row so a barn with several leads gets one nudge, not a burst.
  let invited = false;
  if (!delivered && !result.isClaimed && result.business.email) {
    const recent = await prisma.auditLog.findFirst({
      where: {
        entityId: result.business.id,
        action: "CLAIM_INVITE_SENT",
        createdAt: { gte: new Date(Date.now() - CLAIM_INVITE_COOLDOWN_MS) },
      },
      select: { id: true },
    });
    if (!recent) {
      const waitingCount = await prisma.inquiry.count({ where: { businessId: result.business.id } });
      await sendClaimInviteForInquiry(result.business.email, {
        businessName: result.business.name,
        claimUrl: absoluteUrl(`/business/${result.business.slug}/claim`),
        waitingCount,
      });
      await prisma.auditLog.create({
        data: {
          action: "CLAIM_INVITE_SENT",
          entityType: "Business",
          entityId: result.business.id,
          performedBy: "system:inquiry",
          details: { inquiryId: result.inquiry.id, waitingCount },
        },
      });
      invited = true;
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "INQUIRY_CREATED",
      entityType: "Business",
      entityId: result.business.id,
      performedBy: userId ? email : `guest:${email}`,
      details: { inquiryId: result.inquiry.id, userId, delivered, invited },
    },
  });

  // Operator concierge alert: notify YOU on every lead with the barn's phone +
  // claim link, so you can personally text an (unclaimed, phone-only) barn to
  // claim and reply. This is the no-GHL, consent-safe way to start converting
  // barns — a manual one-to-one text off a real inbound lead.
  if (OPS_ALERT_EMAIL) {
    await sendOperatorInquiryAlert(OPS_ALERT_EMAIL, {
      businessName: result.business.name,
      businessPhone: result.business.phone,
      businessLocation: result.business.address,
      claimUrl: absoluteUrl(`/business/${result.business.slug}/claim`),
      isClaimed: result.isClaimed,
      fromName: name,
      fromEmail: email,
      fromPhone: phone,
      message,
    });
  }

  // Report delivery honestly so the form can set the right expectation: a
  // claimed barn replies by email; an unclaimed one has been invited to join.
  return NextResponse.json({
    ok: true,
    delivered,
    message: delivered
      ? "Your inquiry was sent. The stable will reply to your email."
      : "Your message was saved. We've invited this stable to claim their page and reply — we'll email you if they respond.",
  });
}
