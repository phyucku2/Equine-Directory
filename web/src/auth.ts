import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
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
// Resend is an email TRANSPORT only (see src/lib/email.ts), never a login
// provider — Google is the only provider, which keeps the lazy email-keyed
// back-fill below safe from account-takeover ("AccountNotLinked" class).
//
// Env (set in Vercel + Google Cloud OAuth client):
//   AUTH_SECRET         — `openssl rand -base64 32`
//   AUTH_GOOGLE_ID      — OAuth client ID
//   AUTH_GOOGLE_SECRET  — OAuth client secret
//   ADMIN_EMAILS        — comma-separated allow-list of admin emails
// Authorized redirect URI in Google Cloud: <origin>/api/auth/callback/google
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // KEEP jwt — preserves cookies + static SEO
  trustHost: true,
  providers: [Google], // Google ONLY. Resend is a transport, NOT a login provider.
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
