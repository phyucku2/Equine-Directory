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

  // Lead-unlock framing: a FREE owner with waiting inquiries gets a concrete
  // reason to buy Basic right at the top of the plan screen.
  const waitingLeads = entitlements.canReceiveLeads ? 0 : business.inquiries.length;

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Plan &amp; upgrade</h3>
      <p className="mb-5 text-xs text-ink/50">
        Unlock owner photos, trainer profiles, events, and featured placement.
      </p>
      {waitingLeads > 0 && (
        <div className="mb-5 rounded-xl border border-brass/40 bg-brass/5 p-4">
          <p className="text-sm font-semibold text-pine">
            Unlock your {waitingLeads} waiting {waitingLeads === 1 ? "inquiry" : "inquiries"}
          </p>
          <p className="mt-1 text-xs text-ink/60">
            Start with Basic ($9.98/yr) to read every customer message and get notified the moment a
            new one lands.
          </p>
        </div>
      )}
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
