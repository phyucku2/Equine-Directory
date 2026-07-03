import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { STABLES_SLUG, isPublicCategorySlug } from "@/lib/db/business";
import type { AlertFrequency, Prisma } from "@prisma/client";

// Saved searches + alerts (M8a / §3). DB logic lives here, mirroring claim.ts.
//
// A saved search stores a normalized snapshot of the map/filter params
// (`filters Json`) plus a stable `filtersHash` for dedup (one row per
// user+hash) and for matching by the alert engine. The filter set MIRRORS the
// `/api/map` params and the client-side toolbar filters:
//   - category slug (V1 is always STABLES_SLUG = "horse-boarding")
//   - q          free-text name/city query
//   - amenities  string[] (must all be present)
//   - bbox       [west, south, east, north] viewport box
//   - priceFrom  minimum advertised price ceiling (match priceFrom <= X… see runner)
//   - rating     minimum rating
//   - verified   verified-only toggle

export const MAX_ACTIVE_ALERTS_PER_USER = 20;

export interface SavedSearchFilters {
  category: string;
  q?: string;
  amenities?: string[];
  bbox?: [number, number, number, number];
  priceFrom?: number;
  rating?: number;
  verified?: boolean;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function normalizeBbox(v: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 4) return undefined;
  const nums = v.map(Number);
  if (!nums.every(isFiniteNumber)) return undefined;
  // Round to 4 decimals (~11m) so trivially different viewports dedupe.
  const [west, south, east, north] = nums.map((n) => Math.round(n * 1e4) / 1e4) as [
    number,
    number,
    number,
    number,
  ];
  return [west, south, east, north];
}

function normalizeAmenities(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const clean = Array.from(
    new Set(
      v
        .filter((a): a is string => typeof a === "string")
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).sort();
  return clean.length ? clean : undefined;
}

/**
 * Normalize a raw filter object into a canonical, dedup-friendly shape.
 * Unknown/empty fields are dropped; arrays are sorted; numbers are coerced.
 * The result is deterministic for a given logical filter set so two equivalent
 * searches hash identically.
 */
export function normalizeFilters(raw: unknown): SavedSearchFilters {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  // Any public catalog category may be saved; unknown/hidden slugs fall back to
  // boarding so hashes stay stable and hidden categories can't be probed.
  const rawCategory = typeof input.category === "string" ? input.category.trim() : "";
  const category = isPublicCategorySlug(rawCategory) ? rawCategory : STABLES_SLUG;

  const out: SavedSearchFilters = { category };

  if (typeof input.q === "string" && input.q.trim()) out.q = input.q.trim().toLowerCase();

  const amenities = normalizeAmenities(input.amenities);
  if (amenities) out.amenities = amenities;

  const bbox = normalizeBbox(input.bbox);
  if (bbox) out.bbox = bbox;

  const priceFrom = Number(input.priceFrom);
  if (isFiniteNumber(priceFrom) && priceFrom > 0) out.priceFrom = Math.round(priceFrom);

  const rating = Number(input.rating);
  if (isFiniteNumber(rating) && rating > 0) out.rating = Math.min(5, Math.max(0, rating));

  if (input.verified === true || input.verified === "true") out.verified = true;

  return out;
}

/**
 * Stable hash of a normalized filter set. Keys are emitted in a fixed order so
 * the JSON string (and therefore the hash) is deterministic.
 */
export function hashFilters(filters: SavedSearchFilters): string {
  const ordered = {
    category: filters.category,
    q: filters.q ?? null,
    amenities: filters.amenities ?? null,
    bbox: filters.bbox ?? null,
    priceFrom: filters.priceFrom ?? null,
    rating: filters.rating ?? null,
    verified: filters.verified ?? null,
  };
  return createHash("sha256").update(JSON.stringify(ordered)).digest("hex").slice(0, 32);
}

export interface SavedSearchView {
  id: string;
  name: string | null;
  filters: SavedSearchFilters;
  frequency: AlertFrequency;
  emailEnabled: boolean;
  lastCheckedAt: Date | null;
  createdAt: Date;
}

function toView(row: {
  id: string;
  name: string | null;
  filters: Prisma.JsonValue;
  frequency: AlertFrequency;
  emailEnabled: boolean;
  lastCheckedAt: Date | null;
  createdAt: Date;
}): SavedSearchView {
  return {
    id: row.id,
    name: row.name,
    filters: row.filters as unknown as SavedSearchFilters,
    frequency: row.frequency,
    emailEnabled: row.emailEnabled,
    lastCheckedAt: row.lastCheckedAt,
    createdAt: row.createdAt,
  };
}

const VIEW_SELECT = {
  id: true,
  name: true,
  filters: true,
  frequency: true,
  emailEnabled: true,
  lastCheckedAt: true,
  createdAt: true,
} satisfies Prisma.SavedSearchSelect;

/** All of a user's saved searches, newest first. */
export async function listSavedSearches(userId: string): Promise<SavedSearchView[]> {
  const rows = await prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: VIEW_SELECT,
  });
  return rows.map(toView);
}

export interface CreateSavedSearchInput {
  name?: string | null;
  filters: unknown;
  frequency?: AlertFrequency;
  emailEnabled?: boolean;
}

export type CreateSavedSearchResult =
  | { ok: true; search: SavedSearchView; created: boolean }
  | { ok: false; error: "LIMIT"; limit: number };

/**
 * Create (or return the existing) saved search for this user+filter set. The
 * unique `[userId, filtersHash]` constraint means re-saving the same filters is
 * idempotent — we update the name/frequency instead of erroring. Capped at
 * MAX_ACTIVE_ALERTS_PER_USER (the alert engine is O(searches × businesses)).
 */
export async function createSavedSearch(
  userId: string,
  input: CreateSavedSearchInput,
): Promise<CreateSavedSearchResult> {
  const filters = normalizeFilters(input.filters);
  const filtersHash = hashFilters(filters);
  const name = input.name?.trim() ? input.name.trim().slice(0, 255) : null;
  const frequency = input.frequency ?? "DAILY";
  const emailEnabled = input.emailEnabled ?? true;

  const existing = await prisma.savedSearch.findUnique({
    where: { userId_filtersHash: { userId, filtersHash } },
    select: VIEW_SELECT,
  });
  if (existing) {
    const updated = await prisma.savedSearch.update({
      where: { userId_filtersHash: { userId, filtersHash } },
      data: { name, frequency, emailEnabled },
      select: VIEW_SELECT,
    });
    return { ok: true, search: toView(updated), created: false };
  }

  const count = await prisma.savedSearch.count({ where: { userId } });
  if (count >= MAX_ACTIVE_ALERTS_PER_USER) {
    return { ok: false, error: "LIMIT", limit: MAX_ACTIVE_ALERTS_PER_USER };
  }

  const created = await prisma.savedSearch.create({
    data: {
      userId,
      name,
      filters: filters as unknown as Prisma.InputJsonValue,
      filtersHash,
      frequency,
      emailEnabled,
    },
    select: VIEW_SELECT,
  });
  return { ok: true, search: toView(created), created: true };
}

export interface UpdateSavedSearchInput {
  name?: string | null;
  frequency?: AlertFrequency;
  emailEnabled?: boolean;
}

/** Patch a saved search the user owns. Returns null if not found / not theirs. */
export async function updateSavedSearch(
  userId: string,
  id: string,
  input: UpdateSavedSearchInput,
): Promise<SavedSearchView | null> {
  const data: Prisma.SavedSearchUpdateInput = {};
  if (input.name !== undefined) data.name = input.name?.trim() ? input.name.trim().slice(0, 255) : null;
  if (input.frequency !== undefined) data.frequency = input.frequency;
  if (input.emailEnabled !== undefined) data.emailEnabled = input.emailEnabled;

  const result = await prisma.savedSearch.updateMany({ where: { id, userId }, data });
  if (result.count === 0) return null;
  const row = await prisma.savedSearch.findUnique({ where: { id }, select: VIEW_SELECT });
  return row ? toView(row) : null;
}

/** Delete a saved search the user owns. Returns true if a row was removed. */
export async function deleteSavedSearch(userId: string, id: string): Promise<boolean> {
  const result = await prisma.savedSearch.deleteMany({ where: { id, userId } });
  return result.count > 0;
}
