"use client";

import { SessionProvider } from "next-auth/react";

// Client-side session context so the corner auth button can read the session
// without forcing server-rendered pages to become dynamic.
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
