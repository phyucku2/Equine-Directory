"use client";

import { useState } from "react";

interface Filters {
  category?: string;
  q?: string;
  amenities?: string[];
  bbox?: [number, number, number, number];
  priceFrom?: number;
  rating?: number;
  verified?: boolean;
}

export interface SavedSearchItem {
  id: string;
  name: string | null;
  filters: Filters;
  frequency: "INSTANT" | "DAILY" | "WEEKLY";
  emailEnabled: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
}

const FREQUENCIES: { value: SavedSearchItem["frequency"]; label: string }[] = [
  { value: "INSTANT", label: "Instant" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
];

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function describe(f: Filters): string {
  const parts: string[] = [];
  if (f.q) parts.push(`“${f.q}”`);
  if (f.rating) parts.push(`${f.rating}★ & up`);
  if (f.verified) parts.push("Verified only");
  if (f.priceFrom) parts.push(`under $${f.priceFrom}`);
  if (f.amenities?.length) parts.push(f.amenities.join(", "));
  if (f.bbox) parts.push("within map area");
  return parts.length ? parts.join(" · ") : "All stables";
}

export function SearchList({ initial }: { initial: SavedSearchItem[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(id: string, data: Partial<Pick<SavedSearchItem, "frequency" | "emailEnabled" | "name">>) {
    setBusy(id);
    // Optimistic update.
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    try {
      const res = await fetch(`/api/saved-searches/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure by reloading server truth.
      const r = await fetch("/api/saved-searches");
      if (r.ok) setItems((await r.json()).searches);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    const prev = items;
    setItems((p) => p.filter((s) => s.id !== id));
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setItems(prev);
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center text-sm text-ink/60">
        <p>You haven&apos;t saved any searches yet.</p>
        <p className="mt-1">
          On the map, set your filters and tap <strong>Save this search</strong> to get alerted when new
          stables match.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {items.map((s) => (
        <li key={s.id} className="rounded-xl border border-leather/15 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-pine">{s.name || "Saved search"}</p>
              <p className="mt-0.5 truncate text-sm text-ink/60">{describe(s.filters)}</p>
              <p className="mt-1 text-xs text-ink/45">
                Saved {dateFmt.format(new Date(s.createdAt))}
                {s.lastCheckedAt ? ` · last checked ${dateFmt.format(new Date(s.lastCheckedAt))}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(s.id)}
              disabled={busy === s.id}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-leather transition hover:bg-cream-dark disabled:opacity-50"
            >
              Delete
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink/55">Alert</span>
              <div className="flex overflow-hidden rounded-full ring-1 ring-leather/15">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => patch(s.id, { frequency: f.value })}
                    disabled={busy === s.id}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      s.frequency === f.value
                        ? "bg-pine text-cream"
                        : "bg-white text-ink hover:bg-cream-dark"
                    } disabled:opacity-50`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={s.emailEnabled}
                onChange={(e) => patch(s.id, { emailEnabled: e.target.checked })}
                disabled={busy === s.id}
                className="h-4 w-4 rounded border-leather/30 text-pine focus:ring-brass"
              />
              Email me
            </label>
          </div>
        </li>
      ))}
    </ul>
  );
}
