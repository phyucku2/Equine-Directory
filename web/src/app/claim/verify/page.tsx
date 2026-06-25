import Link from "next/link";
import type { Metadata } from "next";
import { verifyClaim } from "@/lib/db/claim";
import { businessUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Verify your claim",
  robots: "noindex,nofollow",
};

export default async function VerifyClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await verifyClaim(token) : { status: "invalid" as const };

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      {result.status === "verified" || result.status === "already" ? (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
            ✓
          </div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">
            {result.status === "already" ? "Already verified" : "Listing verified!"}
          </h1>
          <p className="mt-2 text-stone-600">
            {result.business?.name} is now a verified listing. You can manage its details from your
            dashboard (coming soon).
          </p>
          {result.business && (
            <Link
              href={businessUrl(result.business.slug)}
              className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800"
            >
              View your listing →
            </Link>
          )}
        </>
      ) : (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
            ✕
          </div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Invalid or expired link</h1>
          <p className="mt-2 text-stone-600">
            This verification link isn&apos;t valid. Try claiming your listing again.
          </p>
          <Link href="/claim" className="mt-6 inline-block text-emerald-700 hover:underline">
            Back to claim →
          </Link>
        </>
      )}
    </div>
  );
}
