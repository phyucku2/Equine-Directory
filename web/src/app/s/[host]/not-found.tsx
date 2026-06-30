// Not-found for an unresolved / non-LIVE tenant host (Website Builder).
// Kept minimal and brand-neutral — we don't know the barn's theme here.

import Link from "next/link";
import { SITE } from "@/lib/site";

export default function TenantNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-pine">Site not found</h1>
      <p className="mt-2 max-w-md text-ink/60">
        This address isn&rsquo;t connected to a published stable site yet.
      </p>
      <Link href="/" className="mt-6 text-sm font-medium text-brass hover:underline">
        Go to {SITE.name} →
      </Link>
    </div>
  );
}
