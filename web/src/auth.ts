import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { sendLoginLink } from "@/lib/email";
import type { UserRole } from "@prisma/client";

// Auth.js (NextAuth v5). Google sign-in for horse-owner / barn-owner accounts.
//
// Keep `strategy: "jwt"` while adding the Prisma adapter: this preserves the
// existing session cookies, keeps the public directory statically generated for
// SEO, and avoids forcing every page dynamic. ALL role/identity resolution
// happens inside the `jwt` callback — NOT in `events.signIn` — because with JWT
// sessions an `events` mutation never flows into the freshly-minted token (a
// newly allow-listed admin would stay USER until a forced refresh). The ADMIN
// allow-list is therefore folded into the upsert.
//
// Two providers, BOTH email-verifying, so the email-keyed back-fill below stays
// safe (no "AccountNotLinked"-class takeover):
//   - Google OAuth — Google asserts the email is verified.
//   - Resend magic-link — clicking a link mailed to the address *is* the proof
//     of ownership; an attacker who only knows the email can't complete it.
// Because both prove control of the email, resolving identity by email (the
// upsert in the jwt callback) can't be hijacked, and we deliberately do NOT set
// allowDangerousEmailAccountLinking — the same person signing in either way
// lands on the same email-keyed User, which is correct, not a takeover.
// The magic-link path lets someone who typed their email into an inquiry turn
// it into an account without needing a Google account.
//
// Env (set in Vercel + Google Cloud OAuth client):
//   AUTH_SECRET         — `openssl rand -base64 32`
//   AUTH_GOOGLE_ID      — OAuth client ID
//   AUTH_GOOGLE_SECRET  — OAuth client secret
//   ADMIN_EMAILS        — comma-separated allow-list of admin emails
//   RESEND_API_KEY      — enables the magic-link provider (absent → Google only)
//   EMAIL_FROM          — a Resend-verified sending domain
// Authorized redirect URI in Google Cloud: <origin>/api/auth/callback/google
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Magic-link is OPT-IN behind AUTH_ENABLE_MAGIC_LINK=1 (in addition to needing
// RESEND_API_KEY). This is deliberate: in production RESEND_API_KEY is set (for
// transactional email), so gating on it alone silently turned the email
// provider on in prod-only — and it took down ALL sign-in with an Auth.js
// "Configuration" 500 (preview builds have no RESEND_API_KEY, so they passed
// and hid it). Keeping it flag-gated means prod stays Google-only until the
// magic-link path is verified end-to-end in a preview with the key present.
const emailFrom = process.env.EMAIL_FROM ?? "The Stable Directory <noreply@thestabledirectory.com>";
const providers: Provider[] = [Google];
if (process.env.RESEND_API_KEY && process.env.AUTH_ENABLE_MAGIC_LINK === "1") {
  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: emailFrom,
      // Branded, single-use, 24h link via the shared Resend transport.
      sendVerificationRequest: ({ identifier, url }) => sendLoginLink(identifier, url),
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // KEEP jwt — preserves cookies + static SEO
  trustHost: true,
  providers, // Google + (when configured) Resend magic-link — see note above.
  callbacks: {
    async jwt({ token, user, trigger }) {
      const isAdmin = !!token.email && adminEmails.includes(token.email.toLowerCase());
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: UserRole }).role ?? "USER";
      }
      // Run the email-keyed upsert on:
      //   - first sign-in (`user`): the adapter created the row with the schema
      //     default `role: USER` and has no knowledge of ADMIN_EMAILS, so the
      //     allow-list MUST be applied here or an allow-listed admin resolves to
      //     USER until a forced refresh (§2.1 / M1 done-criterion).
      //   - legacy JWT (no uid): back-fill by email.
      //   - forced refresh (`trigger === "update"`, e.g. just became OWNER).
      //   - any allow-listed email whose token role hasn't been promoted yet.
      if (
        token.email &&
        (user || !token.uid || trigger === "update" || (isAdmin && token.role !== "ADMIN"))
      ) {
        const u = await prisma.user.upsert({
          where: { email: token.email },
          // Only create the minimum identity. NEVER set tokens/accounts here.
          create: {
            email: token.email,
            name: token.name,
            image: token.picture,
            ...(isAdmin ? { role: "ADMIN" } : {}),
          },
          update: isAdmin ? { role: "ADMIN" } : {}, // promote allow-listed admins; never demote here.
          select: { id: true, role: true },
        });
        token.uid = u.id;
        token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as UserRole) ?? "USER";
      }
      return session;
    },
  },
});
