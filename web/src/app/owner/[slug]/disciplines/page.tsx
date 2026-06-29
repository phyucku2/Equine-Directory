import { notFound } from "next/navigation";
import { loadOwnedBusinessWithEntitlements } from "../_shared";
import { DisciplinesForm } from "./DisciplinesForm";
import { UpgradePrompt } from "../_facets/UpgradePrompt";

export const dynamic = "force-dynamic";

// Disciplines & Training tab: disciplines accepted, training services & disciplines,
// lesson levels, and the open/closed-barn trainer policy. Editing is gated behind
// the Verified plan (canEditFacets).
export default async function OwnerDisciplinesPage({
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
        <h3 className="mb-1 text-sm font-semibold text-pine">Disciplines &amp; training</h3>
        <p className="mb-5 text-xs text-ink/50">
          What you accept and what you train powers discipline filters on search.
        </p>
        <UpgradePrompt
          slug={business.slug}
          title="Editing facets is part of the Verified plan"
          body="Verify your barn to edit disciplines, training services, and lesson programs. Your crawled details stay visible to searchers in the meantime."
        />
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Disciplines & training</h3>
      <p className="mb-5 text-xs text-ink/50">
        What you accept and what you train. These drive discipline and training
        filters on search.
      </p>
      <DisciplinesForm
        businessId={business.id}
        initial={{
          disciplines: business.disciplines ?? [],
          trainingTypes: business.trainingTypes ?? [],
          trainingDisciplines: business.trainingDisciplines ?? [],
          lessonLevels: business.lessonLevels ?? [],
          policies: business.policies ?? [],
        }}
      />
    </div>
  );
}
