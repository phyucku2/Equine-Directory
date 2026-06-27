"use client";

import { useState } from "react";
import { StableCard, type StableMarker } from "@/components/stable/StableCard";

// Client grid for /account/saved. All cards start saved; toggling the heart off
// is reflected here by listening for the heart's optimistic state via a key on
// the businessId. We keep it simple: re-fetch is avoided, the card stays in the
// list but the heart reflects the current saved-state.

export function SavedStablesGrid({ initial }: { initial: StableMarker[] }) {
  const [items] = useState(initial);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center">
        <p className="text-sm font-medium text-pine">No saved stables yet</p>
        <p className="mt-1 text-xs text-ink/55">
          Tap the heart on any listing to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <StableCard key={s.slug} s={s} saved />
      ))}
    </div>
  );
}
