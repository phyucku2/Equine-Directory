import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// The owner dashboard is gated and never indexed. Forcing dynamic rendering
// ensures the auth() guard can't be statically leaked into a cached page.
export const metadata: Metadata = { robots: "noindex,nofollow" };
export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/owner")}`);
  }

  const ownershipCount = await prisma.businessOwner.count({
    where: { userId: session.user.id },
  });

  if (ownershipCount === 0) {
    // Signed in but owns no barns yet — show the claim CTA instead of the dashboard.
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-pine">Claim your barn</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink/60">
          You don&apos;t manage any listings yet. Find your barn in the directory and verify
          ownership to unlock the dashboard — edit your listing, respond to reviews, and manage
          inquiries.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-pine px-5 py-2.5 font-semibold text-cream transition hover:bg-pine-light"
        >
          Find your barn
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 border-b border-leather/15 pb-4">
        <h1 className="text-2xl font-bold text-pine">Barn dashboard</h1>
        <p className="mt-1 text-sm text-ink/55">Manage your listings, photos, reviews and inquiries.</p>
      </div>
      {children}
    </div>
  );
}
