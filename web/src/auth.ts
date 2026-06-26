import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Auth.js (NextAuth v5). Google sign-in for horse-owner / barn-owner accounts.
// JWT sessions (no DB tables yet) so adding sign-in does NOT force every page to
// render dynamically — the public directory stays statically generated for SEO.
// When we build owner→business claiming (Phase 2), attach a Prisma adapter + User.
//
// Env (set in Vercel + Google Cloud OAuth client):
//   AUTH_SECRET         — `openssl rand -base64 32`
//   AUTH_GOOGLE_ID      — OAuth client ID
//   AUTH_GOOGLE_SECRET  — OAuth client secret
// Authorized redirect URI in Google Cloud: <origin>/api/auth/callback/google
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  // Vercel sets a trusted host; needed for preview/production deploys.
  trustHost: true,
});
