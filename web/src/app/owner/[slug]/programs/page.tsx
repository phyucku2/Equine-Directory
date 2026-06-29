import { notFound } from "next/navigation";
import { loadOwnedBusinessWithEntitlements } from "../_shared";
import { ProgramsForm } from "./ProgramsForm";
import { UpgradePrompt } from "../_facets/UpgradePrompt";
import type { ProgramEntry } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// Programs & Camps tab: a list editor for camps, clinics, leases, parties, etc.
// Editing is gated behind the Verified plan (canEditFacets).
export default async function OwnerProgramsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadOwnedBusinessWithEntitlements(slug);
  if (!loaded) notFound();
  const { business, entitlements } = loaded;

  if (!entitlements.canEditFacets) {
    return (
      <div>
        <h3 className="mb-1 text-sm font-semibold text-pine">Programs &amp; camps</h3>
        <p className="mb-5 text-xs text-ink/50">
          Camps, clinics, lease programs, and lessons you run.
        </p>
        <UpgradePrompt
          slug={business.slug}
          title="Editing facets is part of the Verified plan"
          body="Verify your barn to list camps, clinics, and lesson programs. Your crawled details stay visible to searchers in the meantime."
        />
      </div>
    );
  }

  const programs = Array.isArray(business.programs)
    ? (business.programs as unknown as ProgramEntry[])
    : [];

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Programs & camps</h3>
      <p className="mb-5 text-xs text-ink/50">
        Camps, clinics, lease programs, lessons, and parties you run. These show in
        the Programs section of your public page.
      </p>
      <ProgramsForm businessId={business.id} initial={programs} />
    </div>
  );
}
