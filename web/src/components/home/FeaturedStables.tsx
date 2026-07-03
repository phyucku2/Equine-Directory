"use client";

import { useEffect, useState } from "react";
import { BusinessCard } from "@/components/business/BusinessCard";
import { RailHeading } from "@/components/home/RailHeading";
import type { BusinessCard as BusinessCardData } from "@/lib/db/business";

// "Featured stables" — LOCAL to the visitor. Server-renders the national
// top-rated set (`initial`) so the section is crawlable + never flashes empty,
// then swaps in the visitor's area (paid/spotlight barns first, then the best
// local barns) from /api/featured once we resolve their location. Uses precise
// browser geolocation only if already granted (never prompts); otherwise the
// endpoint resolves an approximate location from the request headers.
export function FeaturedStables({ initial }: { initial: BusinessCardData[] }) {
  const [items, setItems] = useState<BusinessCardData[]>(initial);

  useEffect(() => {
    let active = true;

    const load = (url: string) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d?.items?.length) setItems(d.items);
        })
        .catch(() => {});

    if (navigator.geolocation && navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (status.state === "granted") {
            navigator.geolocation.getCurrentPosition(
              (pos) => load(`/api/featured?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
              () => load("/api/featured"),
              { timeout: 4000 },
            );
          } else {
            load("/api/featured");
          }
        })
        .catch(() => load("/api/featured"));
    } else {
      load("/api/featured");
    }

    return () => {
      active = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="py-14">
      <RailHeading eyebrow="Featured" title="Featured stables near you" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => (
          <BusinessCard key={b.id} business={b} />
        ))}
      </div>
    </section>
  );
}
