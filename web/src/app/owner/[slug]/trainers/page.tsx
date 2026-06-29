import { notFound } from "next/navigation";
import { loadOwnedBusinessWithEntitlements } from "../_shared";
import { listTrainers } from "@/lib/db/owner";
import { UpgradePrompt } from "../_facets/UpgradePrompt";
import { TrainersManager } from "./TrainersManager";

export const dynamic = "force-dynamic";

// Trainers tab (TEAM tier): CRUD trainer profiles with seat-usage indicator.
// Gated behind maxTrainers > 0; otherwise an upgrade prompt replaces the editor.
export default async function OwnerTrainersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadOwnedBusinessWithEntitlements(slug);
  if (!loaded) notFound();
  const { business, entitlements } = loaded;

  if (entitlements.maxTrainers <= 0) {
    return (
      <div>
        <h3 className="mb-1 text-sm font-semibold text-pine">Trainers</h3>
        <p className="mb-5 text-xs text-ink/50">
          Showcase the trainers at your barn with photos, bios, and disciplines.
        </p>
        <UpgradePrompt
          slug={business.slug}
          title="Trainer profiles are part of the Team plan"
          body="Add public trainer profiles — name, photo, bio, disciplines, and certifications. The Team plan includes 2 seats, with more available at $10/yr each."
        />
      </div>
    );
  }

  const trainers = await listTrainers(business.id);

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Trainers</h3>
      <p className="mb-5 text-xs text-ink/50">
        Each trainer gets a public profile. These power your barn&apos;s trainer pages.
      </p>
      <TrainersManager
        businessId={business.id}
        slug={business.slug}
        maxTrainers={entitlements.maxTrainers}
        initial={trainers.map((t) => ({
          id: t.id,
          name: t.name,
          bio: t.bio,
          photoUrl: t.photoUrl,
          disciplines: t.disciplines,
          certifications: t.certifications,
          email: t.email,
          phone: t.phone,
        }))}
      />
    </div>
  );
}
