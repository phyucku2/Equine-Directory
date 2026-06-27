import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";

// The account area is gated and never indexed. Forcing dynamic rendering ensures
// the auth() guard can't be statically leaked into a cached page.
export const metadata: Metadata = { robots: "noindex,nofollow" };
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/account")}`);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 border-b border-leather/15 pb-4">
        <h1 className="text-2xl font-bold text-pine">Your account</h1>
        <p className="mt-1 text-sm text-ink/55">
          Saved stables, searches, inquiries, reviews and notifications.
        </p>
      </div>
      {children}
    </div>
  );
}
