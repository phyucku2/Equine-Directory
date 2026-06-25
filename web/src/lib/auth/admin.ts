import { cookies } from "next/headers";

// Minimal admin gate for the moderation UI: a shared key in an httpOnly cookie,
// compared to ADMIN_KEY. This is an MVP guard — replace with real auth
// (NextAuth/SSO) before exposing the admin surface publicly.
export const ADMIN_COOKIE = "admin_key";

export function adminKey(): string | undefined {
  return process.env.ADMIN_KEY;
}

export async function isAdmin(): Promise<boolean> {
  const key = adminKey();
  if (!key) return false; // admin disabled until ADMIN_KEY is configured
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === key;
}
