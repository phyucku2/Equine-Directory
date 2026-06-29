import { notFound } from "next/navigation";
import { loadOwnedBusiness } from "../_shared";
import { DisciplinesForm } from "./DisciplinesForm";

export const dynamic = "force-dynamic";

// Disciplines & Training tab: disciplines accepted, training services & disciplines,
// lesson levels, and the open/closed-barn trainer policy.
export default async function OwnerDisciplinesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

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
