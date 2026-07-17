import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, self-validating unsubscribe links for outbound campaigns. The link
// carries the recipient's email plus an HMAC over it (keyed by AUTH_SECRET), so
// the unsubscribe route can trust the address without a per-send DB token row,
// and the link can't be forged to opt out someone else. Shared by the batch
// sender (relative import) and the /api/email/unsubscribe route (@/ import).

// Dedicated signing key for unsubscribe links. Prefer UNSUBSCRIBE_SECRET (set
// identically in Vercel + GitHub Actions) so the key can live in both places
// without ever reading Vercel's hidden AUTH_SECRET back, and so rotating it
// never invalidates user sessions. Falls back to AUTH_SECRET when unset.
function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("UNSUBSCRIBE_SECRET (or AUTH_SECRET) is required to sign unsubscribe links");
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signUnsubscribe(email: string): string {
  const e = email.trim().toLowerCase();
  return createHmac("sha256", secret()).update(e).digest("base64url");
}

/** Recover the email from a link's params, or null if the signature is invalid. */
export function verifyUnsubscribe(encodedEmail: string, sig: string): string | null {
  let email: string;
  try {
    email = Buffer.from(encodedEmail, "base64url").toString("utf8").trim().toLowerCase();
  } catch {
    return null;
  }
  if (!email) return null;
  const expected = signUnsubscribe(email);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return email;
}

/** Build the absolute unsubscribe URL for a recipient. */
export function unsubscribeUrl(baseUrl: string, email: string): string {
  const e = email.trim().toLowerCase();
  const params = new URLSearchParams({ e: b64url(e), s: signUnsubscribe(e) });
  return `${baseUrl.replace(/\/$/, "")}/api/email/unsubscribe?${params.toString()}`;
}
