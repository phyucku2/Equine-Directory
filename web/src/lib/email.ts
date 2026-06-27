import { Resend } from "resend";

// Resend used directly as an email TRANSPORT — NOT as an Auth.js login provider
// (that would open an email-based account-takeover vector; see src/auth.ts).
//
// In non-production, or when RESEND_API_KEY is missing, every send is a no-op
// that logs and (for the claim verification) returns the raw URL instead of
// throwing — so local dev and tests work with zero email config.
//
// Env: RESEND_API_KEY + a verified sending domain (EMAIL_FROM).

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Equine Directory <noreply@equine.directory>";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function canSend(): boolean {
  return process.env.NODE_ENV === "production" && resend !== null;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

async function send(args: SendArgs): Promise<void> {
  if (!canSend() || !resend) {
    console.info("[email:noop]", { to: args.to, subject: args.subject });
    return;
  }
  await resend.emails.send({
    from: EMAIL_FROM,
    to: args.to,
    subject: args.subject,
    html: args.html,
    ...(args.replyTo ? { replyTo: args.replyTo } : {}),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send the claim verification link to the BUSINESS-controlled email (not a
 * claimant-chosen address). Returns the raw verifyUrl in non-production / when
 * email is unconfigured so tests and local dev can complete the flow.
 */
export async function sendClaimVerification(
  toBusinessEmail: string,
  verifyUrl: string,
  businessName: string,
): Promise<{ sent: boolean; url: string }> {
  if (!canSend()) {
    console.info("[email:noop] claim verification", { toBusinessEmail, verifyUrl, businessName });
    return { sent: false, url: verifyUrl };
  }
  await send({
    to: toBusinessEmail,
    subject: `Verify your listing for ${businessName}`,
    html: `
      <p>Someone is claiming the listing for <strong>${escapeHtml(businessName)}</strong> on Equine Directory.</p>
      <p>If this was you, confirm ownership by clicking the link below (valid for 72 hours):</p>
      <p><a href="${verifyUrl}">Verify and claim this listing</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
  return { sent: true, url: verifyUrl };
}

/** Notify a barn owner that a new inquiry (lead) arrived. */
export async function sendOwnerInquiryAlert(
  toBusinessEmail: string,
  args: {
    businessName: string;
    fromName: string;
    fromEmail: string;
    fromPhone?: string | null;
    message: string;
  },
): Promise<void> {
  await send({
    to: toBusinessEmail,
    replyTo: args.fromEmail,
    subject: `New inquiry for ${args.businessName}`,
    html: `
      <p>You have a new inquiry for <strong>${escapeHtml(args.businessName)}</strong>.</p>
      <p><strong>From:</strong> ${escapeHtml(args.fromName)} (${escapeHtml(args.fromEmail)})${
        args.fromPhone ? ` · ${escapeHtml(args.fromPhone)}` : ""
      }</p>
      <blockquote>${escapeHtml(args.message)}</blockquote>
      <p>Reply directly to this email to respond.</p>
    `,
  });
}

/** Send a saved-search digest of newly matching stables to a consumer. */
export async function sendSavedSearchDigest(
  toEmail: string,
  args: {
    searchName: string;
    matches: { name: string; url: string; city?: string | null }[];
  },
): Promise<void> {
  if (args.matches.length === 0) return;
  const items = args.matches
    .map(
      (m) =>
        `<li><a href="${m.url}">${escapeHtml(m.name)}</a>${
          m.city ? ` — ${escapeHtml(m.city)}` : ""
        }</li>`,
    )
    .join("");
  await send({
    to: toEmail,
    subject: `New stables matching "${args.searchName}"`,
    html: `
      <p>New stables match your saved search <strong>${escapeHtml(args.searchName)}</strong>:</p>
      <ul>${items}</ul>
    `,
  });
}
