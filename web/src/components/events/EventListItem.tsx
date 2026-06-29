import Link from "next/link";
import type { PublicEvent } from "@/lib/db/events";
import { eventUrl } from "@/lib/urls";
import { formatEventDate, formatPriceCents } from "@/lib/format";
import { PROGRAM_TYPES } from "@/lib/facets";

const PROGRAM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROGRAM_TYPES.map((p) => [p.slug, p.label]),
);

// One row in an events list/calendar. `showBarn` adds the host barn line (used on
// the global calendar; omitted on a barn's own listing where it's redundant).
export function EventListItem({
  event,
  showBarn = false,
}: {
  event: PublicEvent;
  showBarn?: boolean;
}) {
  const price = formatPriceCents(event.price);
  return (
    <li className="rounded-2xl border border-leather/15 bg-white transition hover:border-brass hover:shadow-sm">
      <Link href={eventUrl(event.business.slug, event.slug)} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brass">
              {PROGRAM_TYPE_LABELS[event.type] ?? event.type}
            </p>
            <p className="mt-0.5 font-semibold text-pine">{event.title}</p>
            <p className="mt-1 text-sm text-ink/60">
              {formatEventDate(event.startDate, event.endDate)}
              {event.location ? ` · ${event.location.name}` : ""}
            </p>
            {showBarn && (
              <p className="mt-0.5 text-xs text-ink/50">Hosted by {event.business.name}</p>
            )}
          </div>
          {price && (
            <span className="shrink-0 rounded-full bg-pine/5 px-2.5 py-1 text-sm font-semibold text-pine">
              {price}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
