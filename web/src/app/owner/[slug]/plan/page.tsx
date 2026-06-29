import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BILLING_ENABLED } from "@/lib/billing/beta";
import { loadOwnedBusinessWithEntitlements } from "../_shared";
import { PlanPanel } from "./PlanPanel";

export const dynamic = "force-dynamic";

// Plan & upgrade tab: current tier + what each unlocks, monthly/annual toggle,
// trainer-seat counter, and Spotlight purchase (city + weeks). Buttons say
// "Request access" in beta (BILLING_ENABLED off); behind the flag they start
// Stripe Checkout. See specs/monetization-tiers.md §"Owner UI".
export default async function OwnerPlanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadOwnedBusinessWithEntitlements(slug);
  if (!loaded) notFound();
  const { business, entitlements } = loaded;

  // The barn's own city is the default Spotlight target (geo-targeted placement).
  const location = await prisma.location.findUnique({
    where: { id: business.locationId },
    select: { id: true, name: true },
  });

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Plan &amp; upgrade</h3>
      <p className="mb-5 text-xs text-ink/50">
        Unlock owner photos, trainer profiles, events, and featured placement.
      </p>
      <PlanPanel
        businessId={business.id}
        tier={entitlements.tier}
        maxTrainers={entitlements.maxTrainers}
        spotlightActive={entitlements.spotlightActive}
        city={location ? { id: location.id, name: location.name } : null}
        billingEnabled={BILLING_ENABLED}
      />
    </div>
  );
}
