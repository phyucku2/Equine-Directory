"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cityUrl } from "@/lib/urls";
import { RailHeading } from "@/components/home/RailHeading";
import type { NearbyCity } from "@/lib/db/nearby";

// Geo-localized city list. Client-side so the homepage stays statically generated
// for SEO — the crawlable static "Florida horse country" hub list remains in the
// HTML as the fallback (and for crawlers); this block layers the visitor's own
// nearby cities on top when geo resolves. A Pompano Beach visitor sees Fort
// Lauderdale / Coral Springs / Boca first. Renders nothing when geo is unknown or
// no nearby cities have barns. See post-launch-fixes.md §1.
export function NearbyCities() {
  const [cities, setCities] = useState<NearbyCity[] | null>(null);

  useEffect(() => {
    let active = true;

    const load = (url: string) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : { cities: [] }))
        .then((d) => {
          if (active) setCities(d.cities ?? []);
        })
        .catch(() => active && setCities([]));

    // Try precise browser geolocation if already granted; never prompt here.
    if (navigator.geolocation && navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (status.state === "granted") {
            navigator.geolocation.getCurrentPosition(
              (pos) =>
                load(`/api/nearby-cities?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
              () => load("/api/nearby-cities"),
              { timeout: 4000 },
            );
          } else {
            load("/api/nearby-cities");
          }
        })
        .catch(() => load("/api/nearby-cities"));
    } else {
      load("/api/nearby-cities");
    }

    return () => {
      active = false;
    };
  }, []);

  // Only cities with a full state/county/city path can form a valid URL.
  const linkable = (cities ?? []).filter((c) => c.stateSlug && c.citySlug);
  if (linkable.length === 0) return null;

  return (
    <section className="py-14">
      <RailHeading eyebrow="Explore" title="Cities near you" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {linkable.map((c) => (
          <Link
            key={`${c.stateSlug}/${c.citySlug}`}
            href={cityUrl(c.stateSlug!, c.citySlug)}
            className="rounded-2xl border border-leather/15 bg-white p-5 transition hover:border-brass hover:shadow-md"
          >
            <h3 className="text-lg font-semibold text-pine">{c.name}</h3>
            <p className="mt-1 text-sm text-ink/55">
              {c.barnCount} {c.barnCount === 1 ? "stable" : "stables"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
