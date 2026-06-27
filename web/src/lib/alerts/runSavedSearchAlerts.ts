import { prisma } from "@/lib/prisma";
import { PUBLIC_CATEGORY_WHERE, STABLES_SLUG } from "@/lib/db/business";
import { normalizeFilters, type SavedSearchFilters } from "@/lib/db/savedSearch";
import { createNotification } from "@/lib/db/notification";
import { sendSavedSearchDigest } from "@/lib/email";
import { businessUrl, absoluteUrl } from "@/lib/urls";
import type { AlertFrequency, Prisma } from "@prisma/client";

// Saved-search alert engine (M8a / §3).
//
// For each saved search, find published STABLES that were created OR updated
// since the search's `lastCheckedAt` and that match the search's filters, then
// (a) write a SAVED_SEARCH Notification and (b) email a digest (when the search
// + user both have email enabled). Finally bump `lastCheckedAt`.
//
// COST: bbox/price/amenity matching that can't be pushed into SQL is done in
// memory per search — O(searches × candidate businesses). Fine at beta volume;
// `MAX_ACTIVE_ALERTS_PER_USER` caps the blast radius. Frequency gates how often
// a given search is eligible (INSTANT every run, DAILY ~24h, WEEKLY ~7d).

const FREQUENCY_INTERVAL_MS: Record<AlertFrequency, number> = {
  INSTANT: 0,
  DAILY: 23 * 60 * 60 * 1000, // a little under 24h so a daily cron never skips a day
  WEEKLY: 6.5 * 24 * 60 * 60 * 1000,
};

// How far back a never-checked search looks on its first run (avoid blasting a
// new search with the entire back-catalogue).
const FIRST_RUN_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

interface Candidate {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  amenities: string[];
  verified: boolean;
  priceFrom: number | null;
  city: string;
}

function matches(c: Candidate, f: SavedSearchFilters): boolean {
  if (f.q) {
    const hay = `${c.name} ${c.city}`.toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  if (f.rating != null && (c.rating ?? 0) < f.rating) return false;
  if (f.verified && !c.verified) return false;
  if (f.amenities && f.amenities.length) {
    const have = new Set(c.amenities.map((a) => a.toLowerCase()));
    if (!f.amenities.every((a) => have.has(a))) return false;
  }
  if (f.priceFrom != null) {
    // The search's priceFrom is a budget ceiling; a stable matches when its own
    // advertised "from" price is at or below it (unknown price never matches a
    // price filter).
    if (c.priceFrom == null || c.priceFrom > f.priceFrom) return false;
  }
  if (f.bbox) {
    const [west, south, east, north] = f.bbox;
    if (c.longitude < west || c.longitude > east || c.latitude < south || c.latitude > north) {
      return false;
    }
  }
  return true;
}

export interface RunResult {
  searchesChecked: number;
  notificationsCreated: number;
  emailsSent: number;
}

export async function runSavedSearchAlerts(now: Date = new Date()): Promise<RunResult> {
  const searches = await prisma.savedSearch.findMany({
    select: {
      id: true,
      userId: true,
      name: true,
      filters: true,
      frequency: true,
      emailEnabled: true,
      lastCheckedAt: true,
      user: { select: { email: true, emailAlertsEnabled: true } },
    },
  });

  let notificationsCreated = 0;
  let emailsSent = 0;
  let searchesChecked = 0;

  for (const s of searches) {
    // Frequency gate: skip searches not yet due.
    if (s.lastCheckedAt) {
      const due = s.lastCheckedAt.getTime() + FREQUENCY_INTERVAL_MS[s.frequency];
      if (now.getTime() < due) continue;
    }
    searchesChecked++;

    const since = s.lastCheckedAt ?? new Date(now.getTime() - FIRST_RUN_LOOKBACK_MS);
    const filters = normalizeFilters(s.filters);

    // SQL-pushable predicates: published stables changed since `since`. The
    // amenity/bbox/price predicates are applied in memory afterwards.
    const where: Prisma.BusinessWhereInput = {
      isPublished: true,
      categories: {
        some: { ...PUBLIC_CATEGORY_WHERE, category: { slug: filters.category || STABLES_SLUG } },
      },
      OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }],
    };

    const rows = await prisma.business.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        latitude: true,
        longitude: true,
        rating: true,
        amenities: true,
        attributes: true,
        verificationBadge: true,
        location: { select: { name: true } },
      },
      take: 500,
    });

    const candidates: Candidate[] = rows.map((b) => {
      const attrs = (b.attributes ?? {}) as { priceFrom?: number };
      return {
        id: b.id,
        slug: b.slug,
        name: b.name,
        latitude: b.latitude,
        longitude: b.longitude,
        rating: b.rating != null ? Number(b.rating) : null,
        amenities: b.amenities ?? [],
        verified: b.verificationBadge !== "UNVERIFIED",
        priceFrom: typeof attrs.priceFrom === "number" ? attrs.priceFrom : null,
        city: b.location?.name ?? "",
      };
    });

    const hits = candidates.filter((c) => matches(c, filters));
    const label = s.name?.trim() || "your saved search";

    if (hits.length > 0) {
      const top = hits.slice(0, 10);
      await createNotification({
        userId: s.userId,
        type: "SAVED_SEARCH",
        title:
          hits.length === 1
            ? `New stable matching ${label}`
            : `${hits.length} new stables matching ${label}`,
        body: top.map((h) => h.name).join(", "),
        url: "/account/searches",
        data: { searchId: s.id, businessIds: top.map((h) => h.id) },
      });
      notificationsCreated++;

      if (s.emailEnabled && s.user.emailAlertsEnabled && s.user.email) {
        await sendSavedSearchDigest(s.user.email, {
          searchName: label,
          matches: top.map((h) => ({
            name: h.name,
            url: absoluteUrl(businessUrl(h.slug)),
            city: h.city || null,
          })),
        });
        emailsSent++;
      }
    }

    await prisma.savedSearch.update({
      where: { id: s.id },
      data: { lastCheckedAt: now },
    });
  }

  return { searchesChecked, notificationsCreated, emailsSent };
}
