"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BusinessCard } from "@/components/business/BusinessCard";
import type { BusinessCard as BusinessCardData } from "@/lib/db/business";

// Results island for a "near me" search. The visitor explicitly asked for
// proximity, so prompting for browser geolocation here is expected (unlike the
// homepage rail, which never prompts). Precise coords are the ideal; if the
// visitor declines or the browser can't provide them, we still fetch — the API
// falls back to Vercel edge geo / IP-city. Only when even that fails (e.g. a
// dev box with no geo headers) do we show the "search a specific area" nudge.
export function NearMeResults({ q, category }: { q: string; category?: string }) {
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [items, setItems] = useState<BusinessCardData[]>([]);

  useEffect(() => {
    let active = true;
    const base = new URLSearchParams();
    if (q) base.set("q", q);
    if (category) base.set("category", category);

    const run = (coords?: { lat: number; lng: number }) => {
      const p = new URLSearchParams(base);
      if (coords) {
        p.set("lat", String(coords.lat));
        p.set("lng", String(coords.lng));
      }
      fetch(`/api/nearby-search?${p.toString()}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => {
          if (!active) return;
          const list: BusinessCardData[] = d.items ?? [];
          setItems(list);
          setState(list.length ? "ready" : "empty");
        })
        .catch(() => active && setState("empty"));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => run({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => run(), // declined or errored — fall back to IP-based geo
        { timeout: 6000 },
      );
    } else {
      run();
    }

    return () => {
      active = false;
    };
  }, [q, category]);

  if (state === "loading") {
    return <p className="rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center text-ink/55">Finding {q ? `${q} ` : ""}nearest you…</p>;
  }

  if (state === "empty") {
    return (
      <p className="rounded-xl border border-dashed border-leather/25 bg-white p-8 text-center text-ink/55">
        We couldn&apos;t detect your location. Allow location access, or search a
        specific city or town in the box above{" "}
        <Link href="/map" className="text-brass hover:underline">
          — or browse the map
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((b) => (
        <BusinessCard key={b.id} business={b} />
      ))}
    </div>
  );
}
