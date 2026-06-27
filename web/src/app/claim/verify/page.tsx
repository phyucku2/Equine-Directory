import type { Metadata } from "next";
import { ConfirmForm } from "./ConfirmForm";

export const metadata: Metadata = {
  title: "Verify your claim",
  robots: "noindex,nofollow",
};

// Thin shell: the page render is PURE (no mutation). Verification only happens
// when the user explicitly confirms, which POSTs to /api/claim/verify — GET
// renders (link prefetch / CSRF) must never grant ownership.
export default async function VerifyClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ConfirmForm token={token ?? null} />;
}
