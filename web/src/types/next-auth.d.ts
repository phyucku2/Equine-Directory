import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Augment the Auth.js session + JWT with our persisted identity (id) and role,
// resolved inside the jwt/session callbacks in src/auth.ts.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: UserRole;
  }
}
