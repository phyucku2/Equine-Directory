"use client";

import { useEffect, useState } from "react";
import { BusinessCard } from "@/components/business/BusinessCard";
import type { BusinessCard as BusinessCardData } from "@/lib/db/business";

// Client-side so the homepage stays statically generated for SEO. Fetches
// geo-aware nearest stables (Vercel edge geo by default; precise coords if the
// visitor opts in). Renders nothing when there's nothing nearby, so the static
// "Florida horse country" section below remains the fallback.
export function NearbyStables() {
  const [items, setItems] = useState<BusinessCardData[] | null>(null);

  useEffect(() => {
    let active = true;

    const load = (url: string) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => {
          if (active) setItems(d.items ?? []);
        })
        .catch(() => active && setItems([]));

    // Try precise browser geolocation if already granted; never prompt here.
    if (navigator.geolocation && navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (status.state === "granted") {
            navigator.geolocation.getCurrentPosition(
              (pos) => load(`/api/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
              () => load("/api/nearby"),
              { timeout: 4000 },
            );
          } else {
            load("/api/nearby");
          }
        })
        .catch(() => load("/api/nearby"));
    } else {
      load("/api/nearby");
    }

    return () => {
      active = false;
    };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="py-14">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">Near you</p>
        <h2 className="mt-1 text-3xl font-semibold text-pine">Stables near you</h2>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => (
          <BusinessCard key={b.id} business={b} />
        ))}
      </div>
    </section>
  );
}
