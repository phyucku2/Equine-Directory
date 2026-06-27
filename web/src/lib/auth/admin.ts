import { auth } from "@/auth";

// Admin gate, now role-based. The legacy ADMIN_KEY cookie path is gone — admins
// are resolved via the ADMIN_EMAILS allow-list inside the JWT callback (see
// src/auth.ts). Same `isAdmin()` signature, so existing call sites keep working.
export async function isAdmin(): Promise<boolean> {
  return (await auth())?.user?.role === "ADMIN";
}
