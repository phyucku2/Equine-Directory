import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Claim your listing",
  description: "Claim your equine business listing to manage your profile and respond to reviews.",
};

export default function ClaimPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Breadcrumbs items={[{ name: "Home", url: "/" }, { name: "Claim your listing", url: "/claim" }]} />
      <h1 className="mt-4 text-3xl font-bold text-stone-900">Claim your business</h1>
      <p className="mt-3 text-stone-600">
        Are you the owner of an equine business in Florida? Claiming your listing lets you keep
        your details accurate, add photos, and respond to reviews — for free.
      </p>
      <ol className="mt-6 space-y-3 text-stone-700">
        <li className="rounded-lg bg-white p-4 ring-1 ring-stone-200">
          <span className="font-semibold text-emerald-800">1.</span> Find your business using{" "}
          <Link href="/search" className="text-emerald-700 hover:underline">search</Link>.
        </li>
        <li className="rounded-lg bg-white p-4 ring-1 ring-stone-200">
          <span className="font-semibold text-emerald-800">2.</span> Click “Claim this business” on
          your listing page.
        </li>
        <li className="rounded-lg bg-white p-4 ring-1 ring-stone-200">
          <span className="font-semibold text-emerald-800">3.</span> Verify ownership by email to
          unlock editing.
        </li>
      </ol>
      <p className="mt-6 text-sm text-stone-500">
        Don&apos;t see your business?{" "}
        <Link href="/search" className="text-emerald-700 hover:underline">Search first</Link> — if
        it&apos;s missing, we&apos;re adding new Florida listings continuously.
      </p>
    </div>
  );
}
