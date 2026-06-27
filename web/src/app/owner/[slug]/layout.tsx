import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { loadOwnedBusiness } from "./_shared";
import { OwnerNav } from "./OwnerNav";

export const dynamic = "force-dynamic";

// Per-barn shell: re-resolves ownership at the boundary (wrong owner -> 404 so
// existence never leaks) and renders the section sub-nav + the live public URL.
export default async function OwnerBusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

  const session = await auth();
  const role = session?.user?.role;
  // The Team tab manages co-owners and is OWNER-only (ADMIN also sees it).
  const showTeam = role === "OWNER" || role === "ADMIN";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/owner" className="text-xs text-ink/45 transition hover:text-pine">
            ← All listings
          </Link>
          <h2 className="truncate text-xl font-bold text-pine">{business.name}</h2>
        </div>
        <Link
          href={`/business/${business.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-leather/20 px-3 py-1.5 text-sm font-medium text-pine transition hover:border-brass/50"
        >
          View public page ↗
        </Link>
      </div>

      <OwnerNav slug={business.slug} showTeam={showTeam} />

      <div className="pt-1">{children}</div>
    </div>
  );
}
