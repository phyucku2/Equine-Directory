import { notFound } from "next/navigation";
import { loadOwnedBusiness } from "../_shared";
import { ProgramsForm } from "./ProgramsForm";
import type { ProgramEntry } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// Programs & Camps tab: a list editor for camps, clinics, leases, parties, etc.
export default async function OwnerProgramsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

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
