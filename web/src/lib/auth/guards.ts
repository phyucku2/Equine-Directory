import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";

// Role-based authorization guards. These throw a typed `AuthError` so route
// handlers can map them to HTTP responses (401/403) in one place.
//
// `requireBusinessOwner(businessId)` is the structural fix for the claim-hijack
// hole: the businessId ALWAYS comes from the caller (the URL), never the request
// body, and ownership is looked up in the BusinessOwner join table. ADMINs bypass.

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const RANK: Record<UserRole, number> = { USER: 0, OWNER: 1, ADMIN: 2 };

type SessionUser = Session["user"];

/** 401 if there is no signed-in session. Returns the session user. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError(401, "Authentication required");
  return session.user;
}

/** 403 unless the signed-in user's role is >= `min` (USER < OWNER < ADMIN). */
export async function requireRole(min: UserRole): Promise<SessionUser> {
  const user = await requireUser();
  if (RANK[user.role] < RANK[min]) throw new AuthError(403, "Insufficient role");
  return user;
}

/** 403 unless the signed-in user is an ADMIN. */
export async function requireAdmin(): Promise<SessionUser> {
  return requireRole("ADMIN");
}

/**
 * 403 unless the signed-in user owns `businessId` (via BusinessOwner) — ADMIN
 * bypasses. `businessId` MUST come from the URL, never the request body.
 */
export async function requireBusinessOwner(businessId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "ADMIN") return user;
  const ownership = await prisma.businessOwner.findUnique({
    where: { userId_businessId: { userId: user.id, businessId } },
    select: { id: true },
  });
  if (!ownership) throw new AuthError(403, "Not an owner of this business");
  return user;
}
