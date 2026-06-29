import { notFound } from "next/navigation";
import { loadOwnedBusinessWithEntitlements } from "../_shared";
import { listEvents } from "@/lib/db/owner";
import { UpgradePrompt } from "../_facets/UpgradePrompt";
import { EventsManager } from "./EventsManager";

export const dynamic = "force-dynamic";

// Events tab (EVENTS tier): CRUD dated events / shows / clinics / camps. Gated
// behind canEvents; otherwise an upgrade prompt replaces the editor.
export default async function OwnerEventsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadOwnedBusinessWithEntitlements(slug);
  if (!loaded) notFound();
  const { business, entitlements } = loaded;

  if (!entitlements.canEvents) {
    return (
      <div>
        <h3 className="mb-1 text-sm font-semibold text-pine">Events</h3>
        <p className="mb-5 text-xs text-ink/50">
          Publish shows, clinics, camps, and clinics with their own public pages.
        </p>
        <UpgradePrompt
          slug={business.slug}
          title="Events are part of the Events plan"
          body="Publish dated events — shows, clinics, camps — each with a public page and a spot on the calendar that feeds the camp finder."
        />
      </div>
    );
  }

  const events = await listEvents(business.id);

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Events</h3>
      <p className="mb-5 text-xs text-ink/50">
        Shows, clinics, and camps you run. Each gets a public event page.
      </p>
      <EventsManager
        businessId={business.id}
        initial={events.map((e) => ({
          id: e.id,
          type: e.type,
          title: e.title,
          description: e.description,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate ? e.endDate.toISOString() : null,
          price: e.price,
          registrationUrl: e.registrationUrl,
          imageUrl: e.imageUrl,
          isPublished: e.isPublished,
        }))}
      />
    </div>
  );
}
