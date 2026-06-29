import type { Metadata } from "next";
import { getUpcomingEvents, eventEnd } from "@/lib/db/events";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventListItem } from "@/components/events/EventListItem";
import { eventsUrl, absoluteUrl } from "@/lib/urls";

export const revalidate = 3600;

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export const metadata: Metadata = {
  title: "Horse Events, Shows, Clinics & Camps",
  description:
    "Upcoming horse shows, clinics, camps, and events at stables across Florida — find something to ride toward.",
  alternates: { canonical: absoluteUrl(eventsUrl()) },
};

export default async function EventsCalendarPage() {
  const events = await getUpcomingEvents();

  // Group upcoming events by month for a simple calendar/list view.
  const groups = new Map<string, { label: string; key: string; items: typeof events }>();
  for (const e of events) {
    const d = e.startDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const g = groups.get(key) ?? { label: MONTH_FMT.format(d), key, items: [] };
    g.items.push(e);
    groups.set(key, g);
  }
  const sorted = Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs
        items={[
          { name: "Home", url: "/" },
          { name: "Events", url: eventsUrl() },
        ]}
      />
      <h1 className="mt-4 text-3xl font-semibold text-pine">Upcoming horse events</h1>
      <p className="mt-1 text-ink/55">
        Shows, clinics, camps, and more at stables across Florida.
      </p>

      {events.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center text-ink/55">
          No upcoming events yet — check back soon.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {sorted.map((g) => (
            <section key={g.key}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/55">
                {g.label}
              </h2>
              <ul className="mt-3 space-y-3">
                {g.items
                  .slice()
                  .sort((a, b) => eventEnd(a).getTime() - eventEnd(b).getTime())
                  .map((e) => (
                    <EventListItem key={e.id} event={e} showBarn />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
