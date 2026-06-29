import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getEntitlements } from "@/lib/entitlements";

// Public events data layer (specs/monetization-tiers.md §"Public display").
// Events are an EVENTS-tier surface. Only published events from barns still
// entitled (canEvents) are shown publicly — a downgrade hides them without
// deleting rows. The public calendar/list only surfaces upcoming/ongoing events.

// Event + the barn (and city) it belongs to, for the public event page/list.
export const publicEventInclude = {
  business: {
    select: {
      id: true,
      name: true,
      slug: true,
      subscription: true,
      spotlights: true,
    },
  },
  location: {
    select: {
      name: true,
      slug: true,
      parent: { select: { slug: true, parent: { select: { slug: true } } } },
    },
  },
} satisfies Prisma.EventInclude;

export type PublicEvent = Prisma.EventGetPayload<{ include: typeof publicEventInclude }>;

// An event is publicly visible only if published AND the owning barn is still
// entitled to events (canEvents). Centralized so every public query agrees.
function entitledForEvents(business: PublicEvent["business"]): boolean {
  return getEntitlements(business).canEvents;
}

// An event is "current" for the calendar if its end (or start, if single-day) is
// today or later. Comparison uses endDate ?? startDate.
function eventEnd(e: { startDate: Date; endDate: Date | null }): Date {
  return e.endDate ?? e.startDate;
}

// Upcoming/ongoing published events, soonest first, across all entitled barns.
// Over-fetches then entitlement-filters in app code (canEvents is config-driven).
export async function getUpcomingEvents(
  now: Date = new Date(),
  take = 60,
): Promise<PublicEvent[]> {
  const rows = await prisma.event.findMany({
    where: {
      isPublished: true,
      OR: [{ endDate: { gte: now } }, { endDate: null, startDate: { gte: now } }],
    },
    orderBy: [{ startDate: "asc" }],
    include: publicEventInclude,
    take: take * 2,
  });
  return rows.filter((e) => entitledForEvents(e.business)).slice(0, take);
}

// Upcoming/ongoing published events for one barn (its listing block).
export async function getUpcomingEventsForBusiness(
  businessId: string,
  canEvents: boolean,
  now: Date = new Date(),
  take = 6,
): Promise<PublicEvent[]> {
  if (!canEvents) return [];
  return prisma.event.findMany({
    where: {
      businessId,
      isPublished: true,
      OR: [{ endDate: { gte: now } }, { endDate: null, startDate: { gte: now } }],
    },
    orderBy: [{ startDate: "asc" }],
    include: publicEventInclude,
    take,
  });
}

// A single event by barn slug + event slug. null if missing/unpublished or the
// barn is no longer entitled.
export async function getPublicEvent(
  businessSlug: string,
  eventSlug: string,
): Promise<PublicEvent | null> {
  const event = await prisma.event.findFirst({
    where: { slug: eventSlug, isPublished: true, business: { slug: businessSlug } },
    include: publicEventInclude,
  });
  if (!event) return null;
  if (!entitledForEvents(event.business)) return null;
  return event;
}

// Published, currently-entitled, upcoming events for the sitemap.
export async function getEventsForSitemap(now: Date = new Date()): Promise<PublicEvent[]> {
  const rows = await prisma.event.findMany({
    where: {
      isPublished: true,
      OR: [{ endDate: { gte: now } }, { endDate: null, startDate: { gte: now } }],
    },
    include: publicEventInclude,
    take: 1000,
  });
  return rows.filter((e) => entitledForEvents(e.business));
}

export { eventEnd };
